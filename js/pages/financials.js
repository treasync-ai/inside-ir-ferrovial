import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, stat, loading, errBox, callout } from '../ui.js';
import { barChart, multiLine, COLORS } from '../charts.js';

const last = (a) => (a && a.length) ? a[a.length - 1] : null;

export default async function render(root) {
  root.innerHTML = pageHead('Financials',
    'Consolidated results 2016–2025 and the debt structure, from the FY2025 Investor Pack, plus Ferrovial-reported KPIs and detailed IFRS statements.') +
    `<div id="fin-kpi" class="mb">${loading('Loading financials…')}</div>
     <div class="card mb" id="fin-pnl"></div>
     <div class="grid g2 mb"><div class="card" id="fin-div"></div><div class="card" id="fin-charts"></div></div>
     <div class="card mb" id="fin-debt"></div>
     <div class="card">
       <div class="spread mb"><div><h3>Detailed IFRS statements</h3><div class="card-sub">Live from Yahoo fundamentals</div></div>
         <div class="range-btns" id="fin-freq"><button data-f="annual" class="active">Annual</button><button data-f="quarterly">Quarterly</button></div></div>
       <div id="fin-detail">${loading('Loading statements…')}</div>
     </div>`;

  const [pack, baseline] = await Promise.all([
    data('pack-financials.json').catch(() => null),
    data('financials-baseline.json').catch(() => null)
  ]);
  if (pack) { renderKPI(pack, baseline); renderPnl(pack); renderDivision(pack); renderCharts(pack); renderDebt(pack); }
  else document.getElementById('fin-kpi').innerHTML = errBox('pack-financials.json not found — run scripts/build-pack.py.');

  const loadDetail = (freq) => {
    document.getElementById('fin-detail').innerHTML = loading('Loading…');
    api('financials', { freq }).then(renderDetail).catch(() =>
      { document.getElementById('fin-detail').innerHTML = errBox('Detailed IFRS statements are refreshing — the sections above are always available.'); });
  };
  document.getElementById('fin-freq').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#fin-freq button').forEach((x) => x.classList.toggle('active', x === b));
    loadDetail(b.dataset.f);
  });
  loadDetail('annual');
}

function renderKPI(p, bl) {
  const inc = p.income, nd = p.netDebt;
  const by = bl ? Object.fromEntries((bl.years || []).map((y) => [y.year, y])) : {};
  const b2025 = by[2025] || {};
  document.getElementById('fin-kpi').innerHTML = `<div class="grid g4">
    ${stat('Revenue 2025', fmt.millions(last(inc.revenue)))}
    ${stat('Adjusted EBITDA', fmt.millions(last(inc.adjEbitda)))}
    ${stat('Net profit (attrib.)', fmt.millions(last(inc.netAttrib)))}
    ${stat('Net cash ex-projects', fmt.millions(last(nd.exInfra)), 'recourse')}
    ${stat('Consolidated net debt', fmt.millions(last(nd.consolidated)), 'incl. non-recourse')}
    ${stat('Order book', b2025.orderBook ? fmt.millions(b2025.orderBook) : '—', 'Construction')}
    ${stat('Dividends from projects', b2025.projectDividends ? fmt.millions(b2025.projectDividends) : '—', 'cash to holding')}
    ${stat('Adjusted EBIT', fmt.millions(last(inc.adjEbit)))}
  </div>`;
}

function packTable(years, rows) {
  const head = `<th style="text-align:left">€m</th>` + years.map((y) => `<th>${y}</th>`).join('');
  const body = rows.map(([label, arr, f]) =>
    `<tr><td style="text-align:left">${label}</td>` + years.map((_, i) => `<td>${arr && arr[i] != null ? (f ? f(arr[i]) : fmt.int(arr[i])) : '<span class="muted">—</span>'}</td>`).join('') + `</tr>`).join('');
  return `<div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderPnl(p) {
  const i = p.income, Y = i.years;
  document.getElementById('fin-pnl').innerHTML = `<h3>Consolidated P&amp;L <span class="pill y" style="font-size:11px">Investor Pack</span></h3>
    <div class="card-sub">€m · 2016–2025 · adjusted (non-IFRS) metrics as Ferrovial reports</div>
    ${packTable(Y, [
      ['Revenue', i.revenue], ['Adjusted EBITDA', i.adjEbitda], ['Adjusted EBIT', i.adjEbit],
      ['Operating profit', i.operatingProfit], ['Net profit (attributable)', i.netAttrib]
    ])}
    ${callout('Read this right', 'FY2024 net profit (€3,239m) was inflated by ~€2.5bn of Heathrow/AGS disposal gains; FY2025 (€888m) is the clean operating year. The step-down in revenue after 2017 reflects the divestment of the Services division.')}`;
}

function renderDivision(p) {
  const d = p.income.division, Y = p.income.years;
  document.getElementById('fin-div').innerHTML = `<h3>Revenue by division</h3><div class="card-sub">€m</div>
    <div class="chart-box" style="height:240px"><canvas id="fin-div-chart"></canvas></div>`;
  const mk = (name, color) => ({ label: name, data: d[name.toLowerCase()], color, width: 2 });
  multiLine(document.getElementById('fin-div-chart'), Y.map(String), [
    mk('Construction', COLORS.GRAY), mk('Highways', COLORS.YELLOW),
    mk('Energy', '#159a5b'), mk('Airports', '#2c6cb0')
  ], { yFmt: (v) => fmt.compact(v) });
}

function renderCharts(p) {
  const i = p.income, Y = i.years;
  document.getElementById('fin-charts').innerHTML = `<h3>Revenue &amp; EBITDA trend</h3><div class="card-sub">€m</div>
    <div class="chart-box" style="height:240px"><canvas id="fin-trend"></canvas></div>`;
  multiLine(document.getElementById('fin-trend'), Y.map(String), [
    { label: 'Revenue', data: i.revenue, color: COLORS.YELLOW, width: 2 },
    { label: 'Adj. EBITDA', data: i.adjEbitda, color: COLORS.INK, width: 2 }
  ], { yFmt: (v) => fmt.compact(v) });
}

function renderDebt(p) {
  const nd = p.netDebt, Y = nd.years, bk = nd.buckets || {};
  const pctf = (v) => v != null ? fmt.num(v * 100, 1) + '%' : '—';
  const structRow = (name, b) => b ? `<tr><td style="text-align:left"><b>${name}</b></td>
    <td>${pctf(last(b.fixed))}</td><td>${b.rate ? fmt.num(last(b.rate) * 100, 2) + '%' : '—'}</td><td>${b.maturity ? fmt.num(last(b.maturity), 1) + ' yr' : '—'}</td></tr>` : '';
  document.getElementById('fin-debt').innerHTML = `<h3>Net debt &amp; structure <span class="pill y" style="font-size:11px">Investor Pack</span></h3>
    <div class="card-sub">The recourse / non-recourse split — €m</div>
    ${packTable(Y, [
      ['Net debt ex-projects (recourse)', nd.exInfra], ['Net debt of projects (non-recourse)', nd.projects], ['Consolidated net debt', nd.consolidated]
    ])}
    <h4 style="margin-top:16px">Debt structure (2025)</h4>
    <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr><th style="text-align:left">Bucket</th><th>% fixed</th><th>Avg rate</th><th>Avg maturity</th></tr></thead>
      <tbody>${structRow('Ex-projects (corporate)', bk.exInfra)}${structRow('Infrastructure projects', bk.projects)}</tbody></table></div>
    ${callout('Why this matters', 'The ~€5.9bn consolidated net debt is almost entirely <b>non-recourse project debt</b> (96% fixed, ~18-yr average life) that does not contaminate the parent. At the corporate level Ferrovial runs a <b>net cash</b> position (~€1.3bn), 99% fixed at ~2% over ~3 years.')}`;
}

function renderDetail(d) {
  const rows = (d.rows || []).filter((r) => r.revenue != null || r.netIncome != null);
  if (!rows.length) { document.getElementById('fin-detail').innerHTML = errBox('No detailed data for this frequency yet.'); return; }
  const cols = rows.slice(-8);
  const lines = [
    ['revenue', 'Revenue', (v) => fmt.compact(v, 'EUR')], ['ebitda', 'EBITDA', (v) => fmt.compact(v, 'EUR')],
    ['netIncome', 'Net income', (v) => fmt.compact(v, 'EUR')], ['dilutedEPS', 'Diluted EPS', (v) => v == null ? '—' : '€' + fmt.num(v, 2)],
    ['freeCashFlow', 'Free cash flow', (v) => fmt.compact(v, 'EUR')], ['netDebt', 'Net debt', (v) => fmt.compact(v, 'EUR')],
    ['equity', 'Equity', (v) => fmt.compact(v, 'EUR')], ['totalAssets', 'Total assets', (v) => fmt.compact(v, 'EUR')]
  ];
  const head = `<th style="text-align:left">${d.freq === 'quarterly' ? 'Quarter' : 'Year'}</th>` + cols.map((c) => `<th>${d.freq === 'quarterly' ? c.period : c.year}</th>`).join('');
  const body = lines.map(([k, label, f]) =>
    `<tr><td style="text-align:left">${label}</td>` + cols.map((c) => `<td>${c[k] == null ? '<span class="muted">—</span>' : f(c[k])}</td>`).join('') + `</tr>`).join('');
  document.getElementById('fin-detail').innerHTML = `<div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
