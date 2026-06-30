import { api } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, loading, errBox, callout } from '../ui.js';
import { barChart, COLORS } from '../charts.js';

export default async function render(root) {
  root.innerHTML = pageHead('Ferrovial vs peers',
    'How Ferrovial screens against six infrastructure & construction peers on valuation. Multiples are currency-neutral; market caps are in each company’s reporting currency.') +
    `<div id="peers-table" class="mb">${loading('Loading peer valuations…')}</div>
     <div class="grid g2 mb">
       <div class="card"><h3>EV/EBITDA</h3><div class="card-sub">Lower = cheaper. Ferrovial highlighted.</div><div class="chart-box" style="height:260px"><canvas id="p-ev"></canvas></div></div>
       <div class="card"><h3>P/E (trailing)</h3><div class="card-sub">Ferrovial highlighted.</div><div class="chart-box" style="height:260px"><canvas id="p-pe"></canvas></div></div>
     </div>
     <div id="peers-note"></div>`;

  try {
    const d = await api('peers');
    const rows = d.rows || [];
    renderTable(rows);
    const evItems = rows.filter((r) => r.evEbitda != null).map((r) => ({ label: r.name, value: r.evEbitda, self: r.self }));
    const peItems = rows.filter((r) => r.pe != null).map((r) => ({ label: r.name, value: r.pe, self: r.self }));
    if (evItems.length) barChart(document.getElementById('p-ev'), evItems, { yFmt: (v) => fmt.num(v, 0) + 'x' });
    if (peItems.length) barChart(document.getElementById('p-pe'), peItems, { yFmt: (v) => fmt.num(v, 0) + 'x' });
    document.getElementById('peers-note').innerHTML = callout('The valuation debate',
      'Ferrovial trades at a clear premium to construction-heavy peers (Vinci, ACS, Eiffage, Sacyr) and screens closer to pure toll-road quality (Transurban) and regulated airports (Aena). The premium reflects the duration and pricing power of its North-American toll roads — the bull case — while the 2026 sell-side downgrades (Citi, Jefferies, Bernstein) were <b>valuation-driven, not thesis-driven</b>.');
  } catch {
    document.getElementById('peers-table').innerHTML = errBox('Peer data loads on Vercel (or with `vercel dev`). Peer set: Vinci, Eiffage, ACS, Sacyr, Transurban, Aena.');
  }
}

function renderTable(rows) {
  const cols = [
    ['name', 'Company', (r) => `<b>${esc(r.name)}</b><div class="small muted">${esc(r.type)}</div>`],
    ['marketCap', 'Mkt cap', (r) => fmt.compact(r.marketCap, r.currency)],
    ['pe', 'P/E', (r) => fmt.num(r.pe, 1) + (r.pe != null ? 'x' : '')],
    ['forwardPE', 'Fwd P/E', (r) => r.forwardPE != null ? fmt.num(r.forwardPE, 1) + 'x' : '—'],
    ['evEbitda', 'EV/EBITDA', (r) => r.evEbitda != null ? fmt.num(r.evEbitda, 1) + 'x' : '—'],
    ['priceToBook', 'P/B', (r) => r.priceToBook != null ? fmt.num(r.priceToBook, 1) + 'x' : '—'],
    ['dividendYield', 'Div yield', (r) => r.dividendYield != null ? fmt.num(r.dividendYield, 1) + '%' : '—'],
    ['ebitdaMargin', 'EBITDA mgn', (r) => r.ebitdaMargin != null ? fmt.num(r.ebitdaMargin, 1) + '%' : '—'],
    ['ret1y', '1Y return', (r) => fmt.pctHTML(r.ret1y)]
  ];
  const head = cols.map((c) => `<th${c[0] === 'name' ? ' style="text-align:left"' : ''}>${c[1]}</th>`).join('');
  const body = rows.map((r) => `<tr class="${r.self ? 'self' : ''}">` +
    cols.map((c, i) => `<td${i === 0 ? ' style="text-align:left"' : ''}>${c[2](r)}</td>`).join('') + `</tr>`).join('');
  document.getElementById('peers-table').innerHTML =
    `<div class="tbl-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
     <div class="small muted" style="margin-top:8px">Live multiples via Yahoo Finance. Market caps shown in local reporting currency (Transurban in AUD).</div>`;
}
