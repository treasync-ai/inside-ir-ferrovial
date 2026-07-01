import { api } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, loading, errBox, callout } from '../ui.js';
import { barChart, multiLine, COLORS } from '../charts.js';

export default async function render(root) {
  root.innerHTML = pageHead('Ferrovial vs peers',
    'How Ferrovial screens against its European infrastructure & construction peer set on valuation and total return.') +
    `<div id="peers-table" class="mb">${loading('Loading peer valuations…')}</div>
     <div class="grid g2 mb">
       <div class="card"><h3>EV/EBITDA</h3><div class="card-sub">Lower = cheaper. Ferrovial highlighted.</div><div class="chart-box" style="height:260px"><canvas id="p-ev"></canvas></div></div>
       <div class="card"><h3>P/E (trailing)</h3><div class="card-sub">Ferrovial highlighted.</div><div class="chart-box" style="height:260px"><canvas id="p-pe"></canvas></div></div>
     </div>
     <div class="card mb"><h3>Relative performance — 3-year</h3><div class="card-sub">Total return rebased to 100 · Ferrovial vs Vinci, Aena, Sacyr &amp; IBEX 35</div>
       <div class="chart-box" style="height:300px"><canvas id="p-tsr"></canvas></div></div>
     <div id="peers-note"></div>`;

  api('tsr').then((t) => {
    const names = Object.keys(t.series || {});
    if (!names.length) return;
    const colors = { Ferrovial: COLORS.YELLOW, Vinci: '#2c6cb0', Aena: '#159a5b', Sacyr: '#e2614d', 'IBEX 35': COLORS.GRAY };
    multiLine(document.getElementById('p-tsr'), t.labels, names.map((n) => ({ label: n, data: t.series[n], color: colors[n] || COLORS.GRAY, width: n === 'Ferrovial' ? 2.5 : 1.5 })), { yFmt: (v) => fmt.num(v, 0) });
  }).catch(() => {});

  try {
    const d = await api('peers');
    const rows = d.rows || [];
    renderTable(rows);
    const evItems = rows.filter((r) => r.evEbitda != null).map((r) => ({ label: r.name, value: r.evEbitda, self: r.self }));
    const peItems = rows.filter((r) => r.pe != null).map((r) => ({ label: r.name, value: r.pe, self: r.self }));
    if (evItems.length) barChart(document.getElementById('p-ev'), evItems, { yFmt: (v) => fmt.num(v, 0) + 'x' });
    if (peItems.length) barChart(document.getElementById('p-pe'), peItems, { yFmt: (v) => fmt.num(v, 0) + 'x' });
    document.getElementById('peers-note').innerHTML = callout('The valuation debate',
      'Ferrovial trades at a clear premium to its construction-heavy Spanish/French peers (Vinci, Bouygues, Sacyr, Acciona, Eiffage, OHLA) and screens closer to regulated-infrastructure quality (Aena). The premium reflects the duration and pricing power of its North-American toll roads.');
  } catch {
    document.getElementById('peers-table').innerHTML = errBox('Peer data is refreshing — check back shortly. Peer set: Vinci, Bouygues, Sacyr, Acciona, Eiffage, Aena, OHLA.');
  }
}

function renderTable(rows) {
  const cols = [
    ['name', 'Company', (r) => `<b>${esc(r.name)}</b>${r.private ? ' <span class="tag">private</span>' : ''}<div class="small muted">${esc(r.type)}</div>`],
    ['price', 'Price', (r) => r.price != null ? fmt.money(r.price, r.currency, 2) : '—'],
    ['marketCap', 'Mkt cap', (r) => fmt.compact(r.marketCap, r.currency)],
    ['pe', 'P/E *', (r) => r.pe != null ? fmt.num(r.pe, 0) + 'x' : '—'],
    ['evEbitda', 'EV/EBITDA *', (r) => r.evEbitda != null ? fmt.num(r.evEbitda, 0) + 'x' : '—'],
    ['dividendYield', 'Div yield *', (r) => r.dividendYield != null ? fmt.num(r.dividendYield, 1) + '%' : '—'],
    ['ebitdaMargin', 'EBITDA mgn *', (r) => r.ebitdaMargin != null ? fmt.num(r.ebitdaMargin, 0) + '%' : '—'],
    ['ret1y', '1Y return', (r) => fmt.pctHTML(r.ret1y)]
  ];
  const head = cols.map((c) => `<th${c[0] === 'name' ? ' style="text-align:left"' : ''}>${c[1]}</th>`).join('');
  const body = rows.map((r) => `<tr class="${r.self ? 'self' : ''}">` +
    cols.map((c, i) => `<td${i === 0 ? ' style="text-align:left"' : ''}>${c[2](r)}</td>`).join('') + `</tr>`).join('');
  document.getElementById('peers-table').innerHTML =
    `<div class="tbl-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
     <div class="small muted" style="margin-top:8px">Price, market cap &amp; 1Y return are live (Twelve Data). <b>*</b> P/E, EV/EBITDA, dividend yield &amp; EBITDA margin are live where the feed exposes them, otherwise curated indicative figures (~mid-2026). Market caps in local reporting currency.</div>`;
}
