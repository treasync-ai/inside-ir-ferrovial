import { api } from '../api.js';
import { fmt, ccy, esc } from '../util.js';
import { pageHead, stat, listingCard, returnsStrip, loading, errBox, callout } from '../ui.js';
import { priceArea } from '../charts.js';

const RANGES = ['1d', '1w', '1m', '3m', '6m', 'ytd', '1y', '5y'];

export default async function render(root) {
  root.innerHTML = pageHead('Global dashboard',
    'The Ferrovial share across its three listings, performance over every window, and the latest headlines.') +
    `<div id="dash-listings" class="grid g3 mb"></div>
     <div class="grid g-2-1 mb">
       <div class="card">
         <div class="spread mb"><div><h3>Ferrovial share price</h3><div class="card-sub">FER.MC · Madrid (EUR) · close prices</div></div>
           <div class="range-btns" id="range-btns">${RANGES.map((r) => `<button data-r="${r}" class="${r === '1y' ? 'active' : ''}">${r.toUpperCase()}</button>`).join('')}</div>
         </div>
         <div class="chart-box" style="height:300px"><canvas id="dash-chart"></canvas></div>
       </div>
       <div class="card" id="dash-ytd"></div>
     </div>
     <div id="dash-returns" class="mb"></div>
     <div class="card"><div class="spread mb"><h3>Latest news</h3><a href="#/news" class="small">All news →</a></div><div id="dash-news">${loading('Loading headlines…')}</div></div>`;

  // --- Quotes ---
  api('quotes').then((d) => {
    document.getElementById('dash-listings').innerHTML = (d.listings || []).map(listingCard).join('');
  }).catch(() => {
    document.getElementById('dash-listings').innerHTML = errBox('Live quotes are refreshing — the first scheduled fetch may still be running (data updates every ~30 min during market hours).');
  });

  // --- History (chart + returns + YTD) ---
  let drawn = false;
  const loadHistory = (range) => api('history', { symbol: 'FER.MC', range }).then((d) => {
    const canvas = document.getElementById('dash-chart');
    if (canvas) priceArea(canvas, d.series || [], { yFmt: (v) => fmt.money(v, d.currency || 'EUR', 1) });
    if (!drawn) {
      drawn = true;
      document.getElementById('dash-returns').innerHTML = `<h3 style="margin:0 0 8px">Performance</h3>` + returnsStrip(d.returns);
      renderYTD(document.getElementById('dash-ytd'), d);
    }
  }).catch(() => {
    const c = document.getElementById('dash-chart');
    if (c) c.parentElement.innerHTML = errBox('Price history is refreshing — check back shortly.');
    document.getElementById('dash-returns').innerHTML = '';
    document.getElementById('dash-ytd').innerHTML = errBox('YTD data is refreshing — check back shortly.');
  });
  loadHistory('1y');

  document.getElementById('range-btns').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#range-btns button').forEach((x) => x.classList.toggle('active', x === b));
    loadHistory(b.dataset.r);
  });

  // --- News preview ---
  api('news').then((d) => {
    const items = (d.items || []).slice(0, 6);
    document.getElementById('dash-news').innerHTML = items.length ? items.map(newsRow).join('') : '<div class="muted small">No headlines available.</div>';
  }).catch(() => { document.getElementById('dash-news').innerHTML = errBox('News is refreshing — check back shortly.'); });
}

function renderYTD(box, d) {
  const y = d.ytd || {};
  box.innerHTML = `<h3>Year-to-date</h3><div class="card-sub">Total return = price + dividends</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      ${stat('Price return', fmt.pctHTML(y.priceReturn))}
      ${stat('Dividend return', fmt.pctHTML(y.dividendReturn))}
    </div>
    <div class="mt8">${stat('Total shareholder return (YTD)', fmt.pctHTML(y.totalReturn))}</div>
    <div class="small muted" style="margin-top:8px">Dividends paid YTD: ${y.dividendsPaid ? fmt.money(y.dividendsPaid, d.currency || 'EUR', 4) : '€0'} / share.</div>`;
}

function newsRow(n) {
  return `<div class="news-item">
    ${n.image ? `<img class="thumb" src="${esc(n.image)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
    <div><a class="t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      <div class="meta"><span>${esc(n.source || n.provider || '')}</span><span>·</span><span>${fmt.ago(n.publishedAt)}</span></div>
    </div></div>`;
}
