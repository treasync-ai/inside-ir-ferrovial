import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, loading, errBox, callout } from '../ui.js';
import { barChart, multiLine, COLORS } from '../charts.js';

export default async function render(root) {
  root.innerHTML = pageHead('Financial statistics',
    "Ferrovial's reported IR KPIs alongside detailed IFRS statements. Toggle annual / quarterly for the detailed view.") +
    `<div class="card mb" id="fin-kpi">${loading('Loading curated KPIs…')}</div>
     <div class="grid g3 mb" id="fin-charts"></div>
     <div class="card">
       <div class="spread mb">
         <div><h3>Detailed financials</h3><div class="card-sub">Source: Yahoo Finance fundamentals (IFRS), refreshed by the scheduled data job.</div></div>
         <div class="range-btns" id="fin-freq"><button data-f="annual" class="active">Annual</button><button data-f="quarterly">Quarterly</button></div>
       </div>
       <div id="fin-detail">${loading('Loading statements…')}</div>
     </div>`;

  // Curated KPI table + charts (always available)
  const baseline = await data('financials-baseline.json').catch(() => null);
  if (baseline) { renderKPIs(baseline); renderCharts(baseline); }
  else document.getElementById('fin-kpi').innerHTML = errBox('financials-baseline.json not found');

  // Detailed (Yahoo)
  const loadDetail = (freq) => {
    document.getElementById('fin-detail').innerHTML = loading('Loading statements…');
    api('financials', { freq }).then((d) => renderDetail(d)).catch(() =>
      { document.getElementById('fin-detail').innerHTML = errBox('Detailed IFRS statements are refreshed by the scheduled data job. The curated KPIs above are always available.'); });
  };
  document.getElementById('fin-freq').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#fin-freq button').forEach((x) => x.classList.toggle('active', x === b));
    loadDetail(b.dataset.f);
  });
  loadDetail('annual');
}

function renderKPIs(bl) {
  const years = bl.years;
  const rows = [
    ['revenue', 'Revenue', fmt.millions],
    ['adjEbitda', 'Adjusted EBITDA', fmt.millions],
    ['adjEbit', 'Adjusted EBIT', fmt.millions],
    ['netProfitAttributable', 'Net profit (attrib.)', fmt.millions],
    ['epsTotal', 'EPS (€)', (v) => v == null ? '—' : '€' + fmt.num(v, 2)],
    ['orderBook', 'Construction order book', fmt.millions],
    ['projectDividends', 'Dividends from projects', fmt.millions],
    ['netCashExProjects', 'Net debt ex-projects', fmt.millions]
  ];
  const head = `<th style="text-align:left">€m unless stated</th>` + years.map((y) => `<th>${y.year}</th>`).join('');
  const body = rows.map(([k, label, f]) =>
    `<tr><td style="text-align:left">${label}</td>` + years.map((y) => `<td>${y[k] == null ? '<span class="muted">—</span>' : f(y[k])}</td>`).join('') + `</tr>`).join('');
  document.getElementById('fin-kpi').innerHTML = `<h3>Ferrovial reported KPIs <span class="tag">curated</span></h3>
    <div class="card-sub">${esc(bl.note)}</div>
    <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    ${callout('Read this right', 'FY2024 net profit (€3,239m) was inflated by ~€2.5bn of Heathrow/AGS disposal gains; FY2025 (€888m) is the clean operating year. EBITDA shown is the non-IFRS <b>adjusted</b> metric Ferrovial headlines.')}`;
}

function renderCharts(bl) {
  const y = bl.years;
  const box = document.getElementById('fin-charts');
  box.innerHTML = `<div class="card"><h3>Revenue</h3><div class="card-sub">€m</div><div class="chart-box" style="height:200px"><canvas id="c-rev"></canvas></div></div>
    <div class="card"><h3>Adjusted EBITDA</h3><div class="card-sub">€m</div><div class="chart-box" style="height:200px"><canvas id="c-ebitda"></canvas></div></div>
    <div class="card"><h3>Dividends from projects</h3><div class="card-sub">€m · cash up to the holding</div><div class="chart-box" style="height:200px"><canvas id="c-div"></canvas></div></div>`;
  const lbl = y.map((x) => x.year);
  barChart(document.getElementById('c-rev'), y.map((x) => ({ label: x.year, value: x.revenue, self: x.year === 2025 })), { yFmt: (v) => fmt.compact(v) });
  barChart(document.getElementById('c-ebitda'), y.map((x) => ({ label: x.year, value: x.adjEbitda, self: x.year === 2025 })), { yFmt: (v) => fmt.compact(v) });
  barChart(document.getElementById('c-div'), y.map((x) => ({ label: x.year, value: x.projectDividends, self: x.year === 2025 })), { yFmt: (v) => fmt.compact(v) });
}

function renderDetail(d) {
  const rows = (d.rows || []).filter((r) => r.revenue != null || r.netIncome != null);
  if (!rows.length) { document.getElementById('fin-detail').innerHTML = errBox('No detailed data returned for this frequency.'); return; }
  const cols = rows.slice(-8);
  const lines = [
    ['revenue', 'Revenue', v => fmt.compact(v, 'EUR')],
    ['grossProfit', 'Gross profit', v => fmt.compact(v, 'EUR')],
    ['ebitda', 'EBITDA', v => fmt.compact(v, 'EUR')],
    ['ebit', 'EBIT / Operating income', v => fmt.compact(v, 'EUR')],
    ['netIncome', 'Net income', v => fmt.compact(v, 'EUR')],
    ['dilutedEPS', 'Diluted EPS', v => v == null ? '—' : '€' + fmt.num(v, 2)],
    ['ebitdaMargin', 'EBITDA margin', v => v == null ? '—' : fmt.num(v, 1) + '%'],
    ['netMargin', 'Net margin', v => v == null ? '—' : fmt.num(v, 1) + '%'],
    ['operatingCF', 'Operating cash flow', v => fmt.compact(v, 'EUR')],
    ['capex', 'Capex', v => fmt.compact(v, 'EUR')],
    ['freeCashFlow', 'Free cash flow', v => fmt.compact(v, 'EUR')],
    ['totalDebt', 'Total debt', v => fmt.compact(v, 'EUR')],
    ['cash', 'Cash & equivalents', v => fmt.compact(v, 'EUR')],
    ['netDebt', 'Net debt', v => fmt.compact(v, 'EUR')],
    ['equity', 'Shareholders equity', v => fmt.compact(v, 'EUR')],
    ['totalAssets', 'Total assets', v => fmt.compact(v, 'EUR')]
  ];
  const head = `<th style="text-align:left">${d.freq === 'quarterly' ? 'Quarter' : 'Year'}</th>` + cols.map((c) => `<th>${d.freq === 'quarterly' ? c.period : c.year}</th>`).join('');
  const body = lines.map(([k, label, f]) =>
    `<tr><td style="text-align:left">${label}</td>` + cols.map((c) => `<td>${c[k] == null ? '<span class="muted">—</span>' : f(c[k])}</td>`).join('') + `</tr>`).join('');
  document.getElementById('fin-detail').innerHTML =
    `<div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
     <div class="small muted" style="margin-top:8px">Figures as reported by Yahoo Finance fundamentals; coverage depth varies for foreign issuers.</div>`;
}
