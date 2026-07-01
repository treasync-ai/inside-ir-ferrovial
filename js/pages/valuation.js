import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, errBox, callout } from '../ui.js';

let MODEL = null, state = null, tab = 'sotp';
let live = { price: null, marketCap: null, source: 'fallback' };

export default async function render(root) {
  MODEL = await data('sotp.json').catch(() => null);
  if (!MODEL) { root.innerHTML = errBox('sotp.json not found'); return; }
  state = initState(MODEL);

  root.innerHTML = pageHead('Valuation — DCF & SOTP',
    'A live sum-of-the-parts and group DCF, seeded from the FY2025 Investor Pack. Move the sidebar drivers and the implied value updates in real time.') +
    `<div class="val-layout">
       <aside class="card val-sidebar">
         <div class="spread"><h3 style="font-size:16px">Model drivers</h3></div>
         <div class="small muted" style="margin-bottom:8px">Live price <b id="val-live">…</b></div>
         <div class="range-btns" id="val-tabs" style="margin-bottom:10px"><button data-t="sotp" class="active">SOTP</button><button data-t="dcf">DCF (group)</button></div>
         <h5>Discount &amp; growth</h5>
         <div id="val-globals"></div>
         <div class="small muted" style="margin-top:4px">Raising the risk-free rate pushes WACC with it — long-duration value falls as rates rise.</div>
         <div id="val-drivers"></div>
       </aside>
       <div>
         <div class="callout" style="margin-top:0">
           <div class="h">How to use</div>
           <b>SOTP</b> values each asset and adds them up (how infrastructure is valued); <b>DCF</b> is a group cross-check. Move <b>WACC</b> and <b>toll growth</b> in the sidebar, fine-tune each asset, and read the implied equity value, value per share and upside vs the live price on the right. Seeded from the Investor Pack; defaults reproduce the ~€43bn equity value, so the sliders show <i>sensitivity</i>.
         </div>
         <div id="val-results"></div>
       </div>
     </div>`;

  api('quotes').then((d) => {
    const es = (d.listings || []).find((l) => l.symbol === 'FER.MC');
    if (es && es.price) live = { price: es.price, marketCap: es.marketCap, source: 'live' };
    setLive(); recompute();
  }).catch(() => { live = { price: MODEL.group.fallbackPriceEur, source: 'fallback' }; setLive(); recompute(); });

  document.getElementById('val-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.t;
    document.querySelectorAll('#val-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    renderDrivers(); recompute();
  });

  renderGlobals();
  renderDrivers();
  recompute();
}

const setLive = () => { const el = document.getElementById('val-live'); if (el) el.textContent = live.price ? fmt.money(live.price, 'EUR', 2) + (live.source === 'live' ? '' : ' (est.)') : '—'; };

function initState(m) {
  const assets = {};
  m.sotp.assets.forEach((a) => { assets[a.id] = {}; Object.entries(a.params).forEach(([k, p]) => { assets[a.id][k] = p.value; }); });
  const dcf = {}; ['baseFcfEur', 'fcfGrowth', 'years', 'terminalGrowth', 'netCashEur'].forEach((k) => { dcf[k] = m.dcf[k].value; });
  return { wacc: m.globals.wacc.value, rf: m.globals.riskFreeRate.value, tollGrowth: m.globals.tollGrowth.value, assets, dcf };
}

// ---------- sliders ----------
function fmtParam(key, v) {
  if (/wacc|growth|rf|Rate|terminal/i.test(key)) return (v * 100).toFixed(2) + '%';
  if (/multiple/i.test(key)) return fmt.num(v, 1) + 'x';
  if (/years/i.test(key)) return Math.round(v) + 'y';
  if (/Eur/i.test(key)) return '€' + fmt.int(v) + 'm';
  return fmt.num(v, 2);
}
function sliderRow(idKey, label, p, extra = '') {
  return `<div class="slider-row"><label>${esc(label)}</label><span class="out" id="out-${idKey}">${fmtParam(idKey, p.value)}</span>
    <input type="range" ${extra} min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}"></div>`;
}

function renderGlobals() {
  const g = MODEL.globals;
  document.getElementById('val-globals').innerHTML =
    sliderRow('g-wacc', g.wacc.label, g.wacc, 'class="global-slider" data-g="wacc"') +
    sliderRow('g-rf', g.riskFreeRate.label, g.riskFreeRate, 'class="global-slider" data-g="rf"') +
    sliderRow('g-tollGrowth', g.tollGrowth.label, g.tollGrowth, 'class="global-slider" data-g="tollGrowth"');
  document.querySelectorAll('#val-globals .global-slider').forEach((inp) => inp.addEventListener('input', onGlobalInput));
}

function renderDrivers() {
  const box = document.getElementById('val-drivers');
  if (tab === 'sotp') {
    box.innerHTML = `<h5>Assumptions by asset</h5>` + MODEL.sotp.assets.map((a) => `
      <div style="margin:6px 0 2px"><b style="font-size:12.5px">${esc(a.name)}</b> <span class="tag">${esc(a.method.split(' ')[0])}</span></div>
      ${Object.entries(a.params).map(([k, p]) => sliderRow(`${a.id}-${k}`, p.label, p, `data-asset="${a.id}" data-key="${k}"`)).join('')}`).join('');
  } else {
    const d = MODEL.dcf;
    box.innerHTML = `<h5>DCF assumptions</h5>` + ['baseFcfEur', 'fcfGrowth', 'years', 'terminalGrowth', 'netCashEur']
      .map((k) => sliderRow(`dcf-${k}`, d[k].label, d[k], `data-asset="dcf" data-key="${k}"`)).join('');
  }
  box.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', onParamInput));
}

function onGlobalInput(e) {
  const key = e.target.dataset.g, v = parseFloat(e.target.value);
  if (key === 'rf') {
    const delta = v - state.rf; state.rf = v;
    state.wacc = Math.max(0.03, Math.min(0.12, state.wacc + delta));
    const w = document.querySelector('.global-slider[data-g="wacc"]');
    if (w) { w.value = state.wacc; document.getElementById('out-g-wacc').textContent = fmtParam('wacc', state.wacc); }
  } else if (key === 'tollGrowth') { state.tollGrowth = v; }
  else { state.wacc = v; }
  document.getElementById('out-g-' + key).textContent = fmtParam(key, v);
  recompute();
}
function onParamInput(e) {
  const a = e.target.dataset.asset, k = e.target.dataset.key, v = parseFloat(e.target.value);
  if (a === 'dcf') state.dcf[k] = v; else state.assets[a][k] = v;
  const out = document.getElementById(`out-${a}-${k}`); if (out) out.textContent = fmtParam(k, v);
  recompute();
}

// ---------- maths ----------
function growingAnnuityPV(d1, g, r, n) {
  if (Math.abs(r - g) < 1e-6) return d1 * n / (1 + r);
  return (d1 / (r - g)) * (1 - Math.pow((1 + g) / (1 + r), n));
}
function assetValue(a) {
  const s = state.assets[a.id];
  switch (a.model) {
    case 'ddm': return growingAnnuityPV(s.baseDividendEur, state.tollGrowth, state.wacc, s.years);
    case 'evEbitda': return s.propEbitdaEur * s.multiple - s.netDebtEur;
    case 'evEbit': return s.adjEbitEur * s.multiple;
    case 'multipleOfBook': return s.bookEur * s.multiple;
    case 'fixed': return s.valueEur;
    default: return 0;
  }
}
function computeSOTP() {
  const assets = MODEL.sotp.assets.map((a) => ({ id: a.id, name: a.name, color: a.color, value: assetValue(a) }));
  const total = assets.reduce((s, x) => s + x.value, 0);
  return { assets, total, perShare: total / MODEL.group.sharesOutstanding };
}
function computeDCF() {
  const { baseFcfEur: base, fcfGrowth: g, years: N, terminalGrowth: gt, netCashEur: cash } = state.dcf;
  const r = state.wacc; let pv = 0, last = base;
  for (let t = 1; t <= N; t++) { last = base * Math.pow(1 + g, t); pv += last / Math.pow(1 + r, t); }
  const tv = (r > gt) ? (last * (1 + gt)) / (r - gt) : last * 25;
  const pvTerminal = tv / Math.pow(1 + r, N), ev = pv + pvTerminal;
  return { ev, pvExplicit: pv, pvTerminal, equity: ev + cash, perShare: (ev + cash) / MODEL.group.sharesOutstanding };
}

// ---------- results ----------
function recompute() {
  const box = document.getElementById('val-results'); if (!box) return;
  const price = live.price || MODEL.group.fallbackPriceEur;
  if (tab === 'sotp') {
    const r = computeSOTP(), up = (r.perShare - price) / price * 100;
    const maxAbs = Math.max(...r.assets.map((a) => Math.abs(a.value)), 1);
    box.innerHTML = `<div class="grid g-1-2">
      <div class="card">
        <div class="stat"><div class="label">Implied equity value</div><div class="val">${fmt.millions(r.total)}</div></div>
        <div class="divider"></div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="stat"><div class="label">Value / share</div><div class="val">${fmt.money(r.perShare, 'EUR', 2)}</div></div>
          <div class="stat"><div class="label">Market price</div><div class="val">${fmt.money(price, 'EUR', 2)}<small> ${live.source === 'live' ? 'live' : 'est.'}</small></div></div>
        </div>
        <div class="mt8 stat"><div class="label">Implied upside / (downside)</div><div class="val">${fmt.pctHTML(up)}</div></div>
      </div>
      <div class="card">
        <h3>Value build-up</h3><div class="card-sub">Each asset’s contribution to equity value (€m)</div>
        ${r.assets.map((a) => { const w = Math.abs(a.value) / maxAbs * 100, neg = a.value < 0;
          return `<div class="asset-bar"><div class="nm">${esc(a.name)}</div><div class="track"><div class="fill" style="width:${w}%;background:${neg ? '#ef9a9a' : a.color}"></div></div><div class="vv">${fmt.millions(a.value)}</div></div>`; }).join('')}
        <div class="divider"></div>
        <div class="asset-bar"><div class="nm"><b>Total equity value</b></div><div class="track"></div><div class="vv"><b>${fmt.millions(r.total)}</b></div></div>
      </div>
    </div>`;
  } else {
    const r = computeDCF(), up = (r.perShare - price) / price * 100, tShare = r.pvTerminal / r.ev * 100;
    box.innerHTML = `<div class="grid g-1-2">
      <div class="card">
        <div class="stat"><div class="label">Enterprise value</div><div class="val">${fmt.millions(r.ev)}</div></div>
        <div class="divider"></div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="stat"><div class="label">Equity value</div><div class="val">${fmt.millions(r.equity)}</div></div>
          <div class="stat"><div class="label">Value / share</div><div class="val">${fmt.money(r.perShare, 'EUR', 2)}</div></div>
        </div>
        <div class="grid mt8" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="stat"><div class="label">Market price</div><div class="val">${fmt.money(price, 'EUR', 2)}</div></div>
          <div class="stat"><div class="label">Implied upside</div><div class="val">${fmt.pctHTML(up)}</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Where the value sits</h3>
        <div class="asset-bar"><div class="nm">PV of explicit FCF</div><div class="track"><div class="fill" style="width:${100 - tShare}%;background:#F2B705"></div></div><div class="vv">${fmt.millions(r.pvExplicit)}</div></div>
        <div class="asset-bar"><div class="nm">PV of terminal value</div><div class="track"><div class="fill" style="width:${tShare}%;background:#aeb6c0"></div></div><div class="vv">${fmt.millions(r.pvTerminal)}</div></div>
        <div class="small muted" style="margin-top:6px">Terminal value is <b>${fmt.num(tShare, 0)}%</b> of EV — how sensitive a DCF is to the discount rate and terminal growth.</div>
        ${callout('Methodology', 'A vanilla group DCF lands below the market because it cannot capture the 70-year 407 concession the way the SOTP/DDM does — that gap is exactly why infrastructure is valued sum-of-the-parts. Use SOTP as the primary lens and this DCF as a sanity check.')}
      </div>
    </div>`;
  }
}
