import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, errBox, callout } from '../ui.js';

let MODEL = null;       // sotp.json
let state = null;       // mutable assumptions
let tab = 'sotp';
let live = { price: null, marketCap: null, source: 'fallback' };

export default async function render(root) {
  MODEL = await data('sotp.json').catch(() => null);
  if (!MODEL) { root.innerHTML = errBox('sotp.json not found'); return; }
  state = initState(MODEL);

  root.innerHTML = pageHead('Ferrovial valuation — DCF & SOTP',
    'Understand why Ferrovial is valued where it is — and where it could be. Move the assumptions and watch both models react in real time. Illustrative, not a target price.') +
    `<div class="card mb" style="background:var(--yellow-l);border-color:#f2d99a">
       <h3 style="margin-bottom:6px">How to use this model</h3>
       <ol class="small" style="margin:0;padding-left:18px">
         <li><b>Pick a method.</b> <b>Sum-of-the-Parts</b> values each asset and adds them up — the way infrastructure is valued; <b>DCF (group)</b> is a whole-company cross-check.</li>
         <li><b>Move the global sliders</b> (WACC, risk-free rate) and watch both models react — raising rates lowers the value of long-duration assets.</li>
         <li><b>Tune each asset</b> in the assumptions below (toll growth, EV/EBITDA multiples, invested equity…) to test a thesis. The 407 ETR is a dividend-discount to 2098; the US Managed Lanes a proportionate EV/EBITDA.</li>
         <li><b>Read the output</b> — implied equity value, value per share, and upside/(downside) vs the live market price. Defaults are calibrated to roughly reproduce the ~€43bn equity value, so the sliders show <i>sensitivity</i>, not a target price.</li>
       </ol>
     </div>
     <div class="card mb">
       <div class="spread mb">
         <div class="range-btns" id="val-tabs"><button data-t="sotp" class="active">Sum-of-the-Parts</button><button data-t="dcf">DCF (group)</button></div>
         <div class="small muted">Live price: <b id="val-live">…</b></div>
       </div>
       <div class="grid g2">
         ${globalSlider('wacc', MODEL.globals.wacc)}
         ${globalSlider('rf', MODEL.globals.riskFreeRate)}
       </div>
       <div class="small muted" style="margin-top:6px">Tip: raising the risk-free rate pushes the WACC up with it — long-duration infrastructure value falls as rates rise.</div>
     </div>
     <div id="val-results" class="mb"></div>
     <div id="val-assumptions"></div>`;

  // live price for comparison
  api('quotes').then((d) => {
    const es = (d.listings || []).find((l) => l.symbol === 'FER.MC');
    if (es && es.price) { live = { price: es.price, marketCap: es.marketCap, source: 'live' }; }
    document.getElementById('val-live').textContent = live.price ? fmt.money(live.price, 'EUR', 2) + (live.source === 'live' ? '' : ' (est.)') : '—';
    recompute();
  }).catch(() => {
    live = { price: MODEL.group.fallbackPriceEur, marketCap: MODEL.group.fallbackMarketCapEur, source: 'fallback' };
    document.getElementById('val-live').textContent = fmt.money(live.price, 'EUR', 2) + ' (est.)';
    recompute();
  });

  document.getElementById('val-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.t;
    document.querySelectorAll('#val-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    renderAssumptions(); recompute();
  });

  // global sliders
  document.querySelectorAll('.global-slider').forEach((inp) => inp.addEventListener('input', onGlobalInput));

  renderAssumptions();
  recompute();
}

function initState(m) {
  const assets = {};
  m.sotp.assets.forEach((a) => {
    assets[a.id] = {};
    Object.entries(a.params).forEach(([k, p]) => { assets[a.id][k] = p.value; });
  });
  const dcf = {};
  ['baseFcfEur', 'fcfGrowth', 'years', 'terminalGrowth', 'netCashEur'].forEach((k) => { dcf[k] = m.dcf[k].value; });
  return { wacc: m.globals.wacc.value, rf: m.globals.riskFreeRate.value, assets, dcf };
}

// ---------- sliders ----------
function fmtParam(key, v) {
  if (/wacc|growth|rf|Rate|terminal/i.test(key)) return (v * 100).toFixed(2) + '%';
  if (/multiple/i.test(key)) return fmt.num(v, 1) + 'x';
  if (/years/i.test(key)) return Math.round(v) + 'y';
  if (/Eur/i.test(key)) return '€' + fmt.int(v) + 'm';
  return fmt.num(v, 2);
}

function globalSlider(key, p) {
  return `<div class="slider-row">
    <label>${esc(p.label)}</label><span class="out" id="out-g-${key}">${fmtParam(key, p.value)}</span>
    <input type="range" class="global-slider" data-g="${key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">
  </div>`;
}

function paramSlider(assetId, key, p) {
  return `<div class="slider-row">
    <label>${esc(p.label)}</label><span class="out" id="out-${assetId}-${key}">${fmtParam(key, p.value)}</span>
    <input type="range" data-asset="${assetId}" data-key="${key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">
  </div>`;
}

function onGlobalInput(e) {
  const key = e.target.dataset.g;
  const v = parseFloat(e.target.value);
  if (key === 'rf') {
    const delta = v - state.rf;
    state.rf = v;
    state.wacc = Math.max(0.03, Math.min(0.12, state.wacc + delta)); // rf pushes WACC
    const w = document.querySelector('.global-slider[data-g="wacc"]');
    if (w) { w.value = state.wacc; document.getElementById('out-g-wacc').textContent = fmtParam('wacc', state.wacc); }
  } else {
    state.wacc = v;
  }
  document.getElementById('out-g-' + key).textContent = fmtParam(key, v);
  recompute();
}

function onParamInput(e) {
  const a = e.target.dataset.asset, k = e.target.dataset.key;
  const v = parseFloat(e.target.value);
  if (a === 'dcf') state.dcf[k] = v; else state.assets[a][k] = v;
  const out = document.getElementById(`out-${a}-${k}`); if (out) out.textContent = fmtParam(k, v);
  recompute();
}

// ---------- assumptions panels ----------
function renderAssumptions() {
  const box = document.getElementById('val-assumptions');
  if (tab === 'sotp') {
    box.innerHTML = `<h3 style="margin:0 0 10px">Assumptions by asset</h3><div class="grid g2">${
      MODEL.sotp.assets.map((a) => `<div class="card tight">
        <div class="spread"><b>${esc(a.name)}</b><span class="pill" style="font-size:11px">${esc(a.method)}</span></div>
        <div class="small muted" style="margin:4px 0 6px">${esc(a.stake !== '—' ? 'Stake ' + a.stake + ' · ' : '')}${esc(a.note)}</div>
        ${Object.entries(a.params).map(([k, p]) => paramSlider(a.id, k, p)).join('')}
      </div>`).join('')}</div>`;
  } else {
    const d = MODEL.dcf;
    box.innerHTML = `<h3 style="margin:0 0 10px">DCF assumptions</h3>
      <div class="card tight">${['baseFcfEur', 'fcfGrowth', 'years', 'terminalGrowth', 'netCashEur'].map((k) => paramSlider('dcf', k, d[k])).join('')}
      ${callout('Why the DCF undershoots', esc(d.note))}</div>`;
  }
  box.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', onParamInput));
}

// ---------- maths ----------
function growingAnnuityPV(d1, g, r, n) {
  if (Math.abs(r - g) < 1e-6) return d1 * n / (1 + r);
  return (d1 / (r - g)) * (1 - Math.pow((1 + g) / (1 + r), n));
}

function assetValue(a) {
  const s = state.assets[a.id];
  switch (a.model) {
    case 'ddm': return growingAnnuityPV(s.baseDividendEur, s.growth, state.wacc, s.years);
    case 'evEbitda': return s.propEbitdaEur * s.multiple - s.netDebtEur;
    case 'evEbit': return s.adjEbitEur * s.multiple;
    case 'multipleOfBook': return s.bookEur * s.multiple;
    case 'fixed': return s.valueEur;
    default: return 0;
  }
}

function computeSOTP() {
  const assets = MODEL.sotp.assets.map((a) => ({ id: a.id, name: a.name, color: a.color, value: assetValue(a) }));
  const total = assets.reduce((sum, x) => sum + x.value, 0);
  return { assets, total, perShare: total / MODEL.group.sharesOutstanding };
}

function computeDCF() {
  const { baseFcfEur: base, fcfGrowth: g, years: N, terminalGrowth: gt, netCashEur: cash } = state.dcf;
  const r = state.wacc;
  let pvExplicit = 0, fcf = [], last = base;
  for (let t = 1; t <= N; t++) { last = base * Math.pow(1 + g, t); pvExplicit += last / Math.pow(1 + r, t); fcf.push(last); }
  const tv = (r > gt) ? (last * (1 + gt)) / (r - gt) : last * 25; // guard
  const pvTerminal = tv / Math.pow(1 + r, N);
  const ev = pvExplicit + pvTerminal;
  const equity = ev + cash;
  return { ev, pvExplicit, pvTerminal, equity, perShare: equity / MODEL.group.sharesOutstanding, fcf };
}

// ---------- results ----------
function recompute() {
  const box = document.getElementById('val-results'); if (!box) return;
  const price = live.price || MODEL.group.fallbackPriceEur;
  if (tab === 'sotp') {
    const r = computeSOTP();
    const up = (r.perShare - price) / price * 100;
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
        ${r.assets.map((a) => {
          const w = Math.abs(a.value) / maxAbs * 100;
          const neg = a.value < 0;
          return `<div class="asset-bar"><div class="nm">${esc(a.name)}</div>
            <div class="track"><div class="fill" style="width:${w}%;background:${neg ? '#ef9a9a' : a.color}"></div></div>
            <div class="vv">${fmt.millions(a.value)}</div></div>`;
        }).join('')}
        <div class="divider"></div>
        <div class="asset-bar"><div class="nm"><b>Total equity value</b></div><div class="track"></div><div class="vv"><b>${fmt.millions(r.total)}</b></div></div>
      </div>
    </div>`;
  } else {
    const r = computeDCF();
    const up = (r.perShare - price) / price * 100;
    const tShare = r.pvTerminal / r.ev * 100;
    box.innerHTML = `<div class="grid g-1-2">
      <div class="card">
        <div class="stat"><div class="label">Enterprise value</div><div class="val">${fmt.millions(r.ev)}</div></div>
        <div class="divider"></div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="stat"><div class="label">Equity value</div><div class="val">${fmt.millions(r.equity)}</div></div>
          <div class="stat"><div class="label">Value / share</div><div class="val">${fmt.money(r.perShare, 'EUR', 2)}</div></div>
        </div>
        <div class="grid mt8" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="stat"><div class="label">Market price</div><div class="val">${fmt.money(price, 'EUR', 2)}<small> ${live.source === 'live' ? 'live' : 'est.'}</small></div></div>
          <div class="stat"><div class="label">Implied upside</div><div class="val">${fmt.pctHTML(up)}</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Where the value sits</h3>
        <div class="asset-bar"><div class="nm">PV of explicit FCF</div><div class="track"><div class="fill" style="width:${100 - tShare}%;background:#F2B705"></div></div><div class="vv">${fmt.millions(r.pvExplicit)}</div></div>
        <div class="asset-bar"><div class="nm">PV of terminal value</div><div class="track"><div class="fill" style="width:${tShare}%;background:#aeb6c0"></div></div><div class="vv">${fmt.millions(r.pvTerminal)}</div></div>
        <div class="small muted" style="margin-top:6px">Terminal value is <b>${fmt.num(tShare, 0)}%</b> of EV — a reminder of how sensitive a DCF is to the discount rate and terminal growth.</div>
        ${callout('Methodology', 'A vanilla group DCF tends to land below the market because it cannot capture the 70-year 407 concession the way the SOTP/DDM does. That gap is exactly why infrastructure is valued sum-of-the-parts — use the SOTP tab as the primary lens and this DCF as a sanity check.')}
      </div>
    </div>`;
  }
}
