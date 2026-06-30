import { api } from '../api.js';
import { fmt, ccy, esc } from '../util.js';
import { pageHead, stat, listingCard, returnsStrip, loading, errBox, callout } from '../ui.js';
import { priceArea } from '../charts.js';

const RANGES = ['1d', '1w', '1m', '3m', '6m', 'ytd', '1y', '5y'];

export default async function render(root) {
  root.innerHTML = pageHead('Global dashboard',
    'Live market sentiment, the Ferrovial share across its three listings, performance over every window, and the latest headlines.') +
    `<div id="dash-sentiment" class="mb"></div>
     <div id="dash-listings" class="grid g3 mb"></div>
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

  // --- Quotes + sentiment ---
  api('quotes').then((d) => {
    document.getElementById('dash-listings').innerHTML = (d.listings || []).map(listingCard).join('');
    renderSentiment(document.getElementById('dash-sentiment'), d.sentiment);
  }).catch(() => {
    document.getElementById('dash-listings').innerHTML = errBox('Live quotes unavailable here. They load on Vercel (or with `vercel dev`).');
    document.getElementById('dash-sentiment').innerHTML = '';
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
    if (c) c.parentElement.innerHTML = errBox('Price history loads on Vercel.');
    document.getElementById('dash-returns').innerHTML = '';
    document.getElementById('dash-ytd').innerHTML = errBox('YTD data loads on Vercel.');
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
  }).catch(() => { document.getElementById('dash-news').innerHTML = errBox('News loads on Vercel.'); });
}

function renderSentiment(box, s) {
  if (!s) { box.innerHTML = ''; return; }
  const idx = s.index ?? 50;
  const dist = s.distribution;
  const total = dist ? (dist.strongBuy + dist.buy + dist.hold + dist.sell + dist.strongSell) : 0;
  box.innerHTML = `<div class="card">
    <div class="gauge">
      <div><div class="big">${idx}<small style="font-size:15px">/100</small></div><div class="lab"><span class="pill y">${esc(s.label)}</span></div></div>
      <div class="meter">
        <div class="track"><div class="needle" style="left:${Math.max(1, Math.min(99, idx))}%"></div></div>
        <div class="spread small muted" style="margin-top:6px"><span>Bearish</span><span>Neutral</span><span>Bullish</span></div>
      </div>
      <div style="min-width:200px">
        <div class="small muted">Analyst consensus</div>
        <div><b>${esc(s.recommendationKey || '—')}</b>${s.numberOfAnalysts ? ` · ${s.numberOfAnalysts} analysts` : ''}</div>
        <div class="small" style="margin-top:6px">Mean target <b>${s.targetMean != null ? fmt.money(s.targetMean, s.currentPrice && s.currentPrice > 100 ? 'USD' : 'EUR', 2) : '—'}</b>
          ${s.upsidePct != null ? `· upside ${fmt.pctHTML(s.upsidePct)}` : ''}</div>
      </div>
    </div>
    ${dist && total ? `<div class="row" style="margin-top:12px;gap:8px">
      ${[['Strong buy', dist.strongBuy, 'green'], ['Buy', dist.buy, 'green'], ['Hold', dist.hold, ''], ['Sell', dist.sell, 'red'], ['Strong sell', dist.strongSell, 'red']]
        .map(([k, v, c]) => `<span class="pill ${c}">${k}: <b>${v}</b></span>`).join('')}
    </div>` : ''}
    <div class="small muted" style="margin-top:8px">Composite of analyst ratings &amp; mean-target upside. Educational, not a recommendation.</div>
  </div>`;
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
