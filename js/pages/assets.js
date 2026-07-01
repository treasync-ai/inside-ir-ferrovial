import { data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, stat, loading, errBox } from '../ui.js';
import { multiLine, barChart, COLORS } from '../charts.js';

const cy = (c) => c === 'CAD' ? 'C$' : c === 'USD' ? '$' : '€';
const last = (a) => (a && a.length) ? a[a.length - 1] : null;
const lbls = (years) => years.map(String);

export default async function render(root) {
  root.innerHTML = pageHead('Assets',
    'Operating and financial detail by asset, from the FY2025 Investor Pack — the crown-jewel 407 ETR, the US Managed Lanes, airports, construction and energy (2016–2025).') +
    `<div id="as-body">${loading('Loading asset data…')}</div>`;

  const a = await data('pack-assets.json').catch(() => null);
  if (!a) { document.getElementById('as-body').innerHTML = errBox('pack-assets.json not found — run scripts/build-pack.py.'); return; }
  const box = document.getElementById('as-body');
  box.innerHTML = `
    ${etrCard(a.etr407)}
    ${lanesCard(a.managedLanes)}
    <div class="grid g2">${dalamanCard(a.dalaman)}${energyCard(a.energy)}</div>
    ${constructionCard(a.construction)}`;

  // draw charts after DOM is in place
  drawEtr(a.etr407);
  drawLanes(a.managedLanes);
  drawDalaman(a.dalaman);
  drawEnergy(a.energy);
  drawConstruction(a.construction);
}

/* ---------- 407 ETR ---------- */
function etrCard(e) {
  const c = e.currency;
  return `<div class="card mb">
    <div class="spread mb"><div><h3>407 ETR — Toronto <span class="pill y" style="font-size:11px">crown jewel · 48.29%</span></h3>
      <div class="card-sub">108-km all-electronic toll road · concession to 2098 · figures ${c}m (100%)</div></div>
      <a href="#/valuation?asset=etr407" class="small" style="white-space:nowrap">Value in SOTP →</a></div>
    <div class="grid g4 mb">
      ${stat('Revenue 2025', cy(c) + fmt.int(last(e.revenue)) + 'm', 'vs ' + cy(c) + fmt.int(e.revenue[e.revenue.length - 2]) + 'm')}
      ${stat('EBITDA 2025', cy(c) + fmt.int(last(e.ebitda)) + 'm', fmt.num(last(e.ebitda) / last(e.revenue) * 100, 1) + '% margin')}
      ${stat('Dividends 2025', cy(c) + fmt.int(last(e.dividends)) + 'm', '100% basis')}
      ${stat('Contribution to FER', '€' + fmt.int(last(e.contribution)) + 'm', 'equity-accounted')}
    </div>
    <div class="grid g2">
      <div><div class="card-sub mb">Revenue &amp; EBITDA (${c}m)</div><div class="chart-box" style="height:220px"><canvas id="as-etr-fin"></canvas></div></div>
      <div><div class="card-sub mb">Traffic (m trips) vs revenue per trip (${c})</div><div class="chart-box" style="height:220px"><canvas id="as-etr-traf"></canvas></div></div>
    </div>
    <div class="small muted" style="margin-top:8px">Revenue/trip rose from ${cy(c)}${fmt.num(e.revPerTrip[1], 2)} (2017) to ${cy(c)}${fmt.num(last(e.revPerTrip), 2)} (2025) — pricing power, not volume, drives the model.</div>
  </div>`;
}
function drawEtr(e) {
  const L = lbls(e.years);
  multiLine(document.getElementById('as-etr-fin'), L, [
    { label: 'Revenue', data: e.revenue, color: COLORS.YELLOW, width: 2 },
    { label: 'EBITDA', data: e.ebitda, color: COLORS.INK, width: 2 }
  ], { yFmt: (v) => fmt.compact(v) });
  multiLine(document.getElementById('as-etr-traf'), L, [
    { label: 'Trips (m)', data: e.trips, color: '#2c6cb0', width: 2 },
    { label: 'Rev/trip', data: e.revPerTrip, color: COLORS.YELLOW, width: 2 }
  ], { yFmt: (v) => fmt.num(v, 0) });
}

/* ---------- US Managed Lanes ---------- */
function lanesCard(l) {
  const A = l.assets, names = Object.keys(A), c = l.currency;
  const rows = names.map((n) => {
    const x = A[n];
    return `<tr><td style="text-align:left"><b>${esc(n)}</b></td>
      <td>${fmt.num(last(x.traffic), 1)}</td><td>${cy(c)}${fmt.num(last(x.revPerTx), 2)}</td>
      <td>${cy(c)}${fmt.int(last(x.revenue))}m</td><td>${cy(c)}${fmt.int(last(x.ebitda))}m</td>
      <td>${x.ebitda && x.revenue ? fmt.num(last(x.ebitda) / last(x.revenue) * 100, 0) + '%' : '—'}</td>
      <td>€${fmt.int(last(x.contribution))}m</td></tr>`;
  }).join('');
  return `<div class="card mb">
    <div class="spread mb"><div><h3>US Managed Lanes <span class="pill y" style="font-size:11px">Cintra · dynamic tolling</span></h3>
      <div class="card-sub">Texas (NTE, LBJ, NTE 35W), North Carolina (I-77), Virginia (I-66) · figures ${c}m (100%), 2025</div></div>
      <a href="#/valuation?asset=lanes" class="small" style="white-space:nowrap">Value in SOTP →</a></div>
    <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr>
      <th style="text-align:left">Asset</th><th>Traffic (m)</th><th>Rev/tx</th><th>Revenue</th><th>EBITDA</th><th>Margin</th><th>Contrib. FER</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
    <div class="grid g2 mt">
      <div><div class="card-sub mb">Revenue per transaction (${c}) — pricing power</div><div class="chart-box" style="height:220px"><canvas id="as-lanes-tx"></canvas></div></div>
      <div><div class="card-sub mb">EBITDA by asset 2025 (${c}m)</div><div class="chart-box" style="height:220px"><canvas id="as-lanes-eb"></canvas></div></div>
    </div>
  </div>`;
}
function drawLanes(l) {
  const A = l.assets, names = Object.keys(A), L = lbls(l.years);
  const palette = ['#c98a00', '#2c6cb0', '#159a5b', '#e2614d', '#7a5cff'];
  multiLine(document.getElementById('as-lanes-tx'), L,
    names.map((n, i) => ({ label: n, data: A[n].revPerTx, color: palette[i % palette.length], width: 1.8 })),
    { yFmt: (v) => fmt.num(v, 0) });
  barChart(document.getElementById('as-lanes-eb'),
    names.map((n) => ({ label: n, value: last(A[n].ebitda) })), { yFmt: (v) => fmt.compact(v) });
}

/* ---------- Dalaman ---------- */
function dalamanCard(d) {
  const c = d.currency;
  return `<div class="card">
    <div class="spread"><h3>Dalaman Airport <span class="pill" style="font-size:11px">60% · Türkiye</span></h3><a href="#/valuation?asset=airports" class="small">Value in SOTP →</a></div>
    <div class="card-sub">Concession to 2042 · figures ${c}m</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:10px 0">
      ${stat('Passengers 2025', fmt.num(last(d.pax), 1) + 'm')}
      ${stat('EBITDA 2025', '€' + fmt.int(last(d.ebitda)) + 'm', fmt.num(last(d.ebitda) / last(d.revenue) * 100, 0) + '% margin')}
    </div>
    <div class="chart-box" style="height:170px"><canvas id="as-dalaman"></canvas></div>
    <div class="small muted" style="margin-top:6px">JFK New Terminal One (49%) is the other airport asset — under construction, phased opening from late-2026.</div>
  </div>`;
}
function drawDalaman(d) {
  multiLine(document.getElementById('as-dalaman'), lbls(d.years), [
    { label: 'Revenue', data: d.revenue, color: COLORS.YELLOW, width: 2 },
    { label: 'EBITDA', data: d.ebitda, color: COLORS.INK, width: 2 }
  ], { yFmt: (v) => '€' + fmt.num(v, 0) });
}

/* ---------- Energy ---------- */
function energyCard(e) {
  return `<div class="card">
    <div class="spread"><h3>Energy <span class="pill" style="font-size:11px">emerging</span></h3><a href="#/valuation?asset=energy" class="small">Value in SOTP →</a></div>
    <div class="card-sub">Solar PV + transmission · figures €m</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:10px 0">
      ${stat('Revenue 2025', '€' + fmt.int(last(e.revenue)) + 'm')}
      ${stat('Adj. EBITDA 2025', '€' + fmt.int(last(e.adjEbitda)) + 'm', 'near break-even')}
    </div>
    <div class="chart-box" style="height:170px"><canvas id="as-energy"></canvas></div>
    <div class="small muted" style="margin-top:6px">Sub-scale today; strategic optionality (US solar + future transmission).</div>
  </div>`;
}

/* ---------- Construction ---------- */
function constructionCard(c) {
  return `<div class="card mb">
    <div class="spread mb"><div><h3>Construction</h3><div class="card-sub">Captive builder of the concessions pipeline + Budimex (Poland) + Webber (US) · €m</div></div><a href="#/valuation?asset=construction" class="small" style="white-space:nowrap">Value in SOTP →</a></div>
    <div class="grid g4 mb">
      ${stat('Revenue 2025', '€' + fmt.int(last(c.revenue)) + 'm')}
      ${stat('Adj. EBIT 2025', '€' + fmt.int(last(c.adjEbit)) + 'm', fmt.num(last(c.adjEbit) / last(c.revenue) * 100, 1) + '% margin')}
      ${stat('Order book 2025', fmt.millions(last(c.orderBook)), 'all-time high')}
      ${stat('Budimex margin', c.budimex.ebitda && c.budimex.revenue ? fmt.num(last(c.budimex.ebitda) / last(c.budimex.revenue) * 100, 1) + '%' : '—', 'EBITDA (the profit engine)')}
    </div>
    <div class="grid g2">
      <div><div class="card-sub mb">Order book (€m)</div><div class="chart-box" style="height:200px"><canvas id="as-constr-ob"></canvas></div></div>
      <div><div class="card-sub mb">Adjusted EBIT margin</div><div class="chart-box" style="height:200px"><canvas id="as-constr-mg"></canvas></div></div>
    </div>
  </div>`;
}
function drawConstruction(c) {
  const L = lbls(c.years);
  barChart(document.getElementById('as-constr-ob'), c.years.map((y, i) => ({ label: y, value: c.orderBook[i], self: y === 2025 })), { yFmt: (v) => fmt.compact(v) });
  const margin = c.years.map((_, i) => (c.adjEbit[i] != null && c.revenue[i]) ? c.adjEbit[i] / c.revenue[i] * 100 : null);
  multiLine(document.getElementById('as-constr-mg'), L, [{ label: 'Adj. EBIT margin %', data: margin, color: COLORS.YELLOW, width: 2 }], { yFmt: (v) => fmt.num(v, 0) + '%', legend: false });
}

function drawEnergy(e) {
  const c = document.getElementById('as-energy'); if (!c) return;
  barChart(c, e.years.map((y, i) => ({ label: y, value: e.revenue[i], self: y === 2025 })), { yFmt: (v) => '€' + fmt.num(v, 0) });
}
