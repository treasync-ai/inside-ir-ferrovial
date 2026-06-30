import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, stat, listingCard, loading, errBox, callout } from '../ui.js';
import { multiLine, COLORS } from '../charts.js';

const LISTINGS = [['FER.MC', 'Madrid'], ['FER', 'Nasdaq'], ['FER.AS', 'Amsterdam']];

export default async function render(root) {
  root.innerHTML = pageHead('Share', 'The Ferrovial share across its three fungible listings, technical analysis, credit ratings, debt issuance and total shareholder return.') +
    `<div id="sh-listings" class="grid g3 mb">${loading()}</div>
     <div class="card mb">
       <div class="spread mb">
         <div><h3>Technical analysis</h3><div class="card-sub">Close vs moving averages · RSI(14)</div></div>
         <select id="sh-sym" style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-weight:600">
           ${LISTINGS.map(([s, n]) => `<option value="${s}">${n} (${s})</option>`).join('')}
         </select>
       </div>
       <div id="sh-signals" class="row mb"></div>
       <div class="chart-box" style="height:280px"><canvas id="sh-price"></canvas></div>
       <div class="chart-box" style="height:120px;margin-top:8px"><canvas id="sh-rsi"></canvas></div>
     </div>
     <div class="grid g2 mb">
       <div class="card" id="sh-ratings">${loading('Loading ratings…')}</div>
       <div class="card" id="sh-debt"></div>
     </div>
     <div class="card" id="sh-tsr"></div>`;

  api('quotes').then((d) => { document.getElementById('sh-listings').innerHTML = (d.listings || []).map(listingCard).join(''); })
    .catch(() => { document.getElementById('sh-listings').innerHTML = errBox('Live quotes load on Vercel.'); });

  const loadTech = (sym) => {
    document.getElementById('sh-signals').innerHTML = loading('Computing indicators…');
    api('technicals', { symbol: sym }).then((d) => renderTech(d)).catch(() => {
      document.getElementById('sh-signals').innerHTML = errBox('Technical data is refreshing — check back shortly.');
    });
  };
  document.getElementById('sh-sym').addEventListener('change', (e) => loadTech(e.target.value));
  loadTech('FER.MC');

  data('ratings.json').then(renderRatings).catch(() => { document.getElementById('sh-ratings').innerHTML = errBox('ratings.json not found'); });
}

function renderTech(d) {
  const i = d.indicators || {};
  const c = d.currency || 'EUR';
  document.getElementById('sh-signals').innerHTML = [
    stat('Price', fmt.money(i.price, c, 2)),
    stat('RSI(14)', `${fmt.num(i.rsi14, 1)} <span class="tag">${esc(i.rsiState || '')}</span>`),
    stat('SMA 50 / 200', `${fmt.num(i.sma50, 2)} / ${fmt.num(i.sma200, 2)}`),
    stat('Trend', `<span style="font-size:14px">${esc(i.trend || '—')}</span>`),
    stat('vs SMA200', fmt.pctHTML(i.vsSma200))
  ].map((s) => `<div style="flex:1;min-width:150px">${s}</div>`).join('');

  const labels = (d.series || []).map((p) => p.t);
  multiLine(document.getElementById('sh-price'), labels, [
    { label: 'Close', data: d.series.map((p) => p.c), color: COLORS.INK, width: 2 },
    { label: 'SMA20', data: d.series.map((p) => p.sma20), color: COLORS.YELLOW, width: 1.5 },
    { label: 'SMA50', data: d.series.map((p) => p.sma50), color: '#2c6cb0', width: 1.3 },
    { label: 'SMA200', data: d.series.map((p) => p.sma200), color: COLORS.GRAY, width: 1.3, dash: [5, 4] }
  ], { yFmt: (v) => fmt.money(v, c, 0) });

  // RSI panel with 30/70 guide lines
  const rsi = d.series.map((p) => p.rsi);
  multiLine(document.getElementById('sh-rsi'), labels, [
    { label: 'RSI', data: rsi, color: '#7a5cff', width: 1.6 },
    { label: '70', data: labels.map(() => 70), color: '#f3c9c9', width: 1, dash: [4, 4] },
    { label: '30', data: labels.map(() => 30), color: '#bfe6cf', width: 1, dash: [4, 4] }
  ], { yFmt: (v) => fmt.num(v, 0), legend: false });
}

function renderRatings(r) {
  const rows = (r.corporate || []).map((x) =>
    `<tr><td>${esc(x.agency)}</td><td>${esc(x.rating)}</td><td>${esc(x.shortTerm)}</td><td>${esc(x.outlook)}</td><td class="muted small" style="text-align:left">${esc(x.lastAction)}</td></tr>`).join('');
  const proj = (r.projectRatings || []).map((x) => `<tr><td style="text-align:left">${esc(x.asset)}</td><td>${esc(x.agency)}</td><td>${esc(x.rating)}</td><td class="small">${esc(x.outlook)}</td></tr>`).join('');
  document.getElementById('sh-ratings').innerHTML = `<h3>Credit ratings</h3><div class="card-sub">Corporate (issuer) ratings</div>
    <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr><th>Agency</th><th>LT</th><th>ST</th><th>Outlook</th><th style="text-align:left">Last action</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${callout('Interview trap', r.trap, 'red')}
    <h4 style="margin-top:14px">Project-level bond ratings</h4>
    <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr><th style="text-align:left">Asset</th><th>Agency</th><th>Rating</th><th>Outlook</th></tr></thead><tbody>${proj}</tbody></table></div>`;

  // Debt + TSR (depend on same file)
  const debt = (r.debtIssuance || []).map((x) =>
    `<tr><td style="text-align:left"><b>${esc(x.instrument)}</b></td><td>${esc(x.size)}</td></tr>
     <tr><td colspan="2" class="muted small" style="text-align:left;padding-top:0">${esc(x.note)}</td></tr>`).join('');
  const b = r.balanceSheet || {};
  document.getElementById('sh-debt').innerHTML = `<h3>Debt issuance &amp; balance sheet</h3>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:10px 0">
      ${stat('Net debt ex-projects', fmt.millions(b.netCashExProjects), b.netCashExProjects < 0 ? 'net cash' : '')}
      ${stat('Consolidated net debt', fmt.millions(b.consolidatedNetDebt), 'incl. non-recourse')}
    </div>
    <div class="tbl-wrap" style="box-shadow:none"><table class="data"><tbody>${debt}</tbody></table></div>
    <div class="small muted" style="margin-top:8px">${esc(b.comment || '')}</div>`;

  const t = r.tsr || {};
  document.getElementById('sh-tsr').innerHTML = `<h3>Total shareholder return &amp; capital returns</h3>
    <p class="small">${esc(t.note || '')}</p>
    <div class="grid g2 mt8">
      ${callout('Buyback programme', esc(t.buybackProgram || ''))}
      ${callout('Dividend', esc(t.dividend || ''))}
    </div>`;
}
