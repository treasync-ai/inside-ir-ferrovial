import { api } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, loading, errBox } from '../ui.js';

export default async function render(root) {
  root.innerHTML = pageHead('News',
    'Ferrovial headlines aggregated automatically and refreshed daily. Sources: Yahoo Finance' ) +
    `<div class="card"><div class="spread mb"><div><h3>Latest coverage</h3><div class="card-sub" id="news-src"></div></div></div><div id="news-list">${loading('Aggregating headlines…')}</div></div>`;

  try {
    const d = await api('news');
    document.getElementById('news-src').textContent = 'Sources: ' + (d.sources || ['Yahoo Finance']).join(', ');
    const items = d.items || [];
    document.getElementById('news-list').innerHTML = items.length ? items.map(row).join('')
      : '<div class="muted">No headlines available right now.</div>';
  } catch {
    document.getElementById('news-list').innerHTML = errBox('News aggregation runs on the server — it loads on Vercel (or with `vercel dev`). Add a free FINNHUB_API_KEY in Vercel for richer, deduped coverage.');
  }
}

function row(n) {
  return `<div class="news-item">
    ${n.image ? `<img class="thumb" src="${esc(n.image)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="thumb"></div>'}
    <div style="flex:1">
      <a class="t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      ${n.summary ? `<div class="small muted" style="margin-top:3px">${esc(n.summary).slice(0, 180)}${n.summary.length > 180 ? '…' : ''}</div>` : ''}
      <div class="meta"><span class="pill" style="font-size:11px">${esc(n.source || n.provider || '')}</span><span>${fmt.date(n.publishedAt, { year: 'numeric', month: 'short', day: 'numeric' })}</span><span class="muted">${fmt.ago(n.publishedAt)}</span></div>
    </div></div>`;
}
