import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, loading, errBox, callout } from '../ui.js';

export default async function render(root) {
  root.innerHTML = pageHead('Financial calendar',
    'Upcoming Ferrovial events — earnings, dividends and milestones. Live estimate from Yahoo merged with a curated cadence baseline.') +
    `<div class="grid g-2-1">
       <div class="card"><h3>Upcoming events</h3><div class="card-sub">▲ = estimate · confirm on Ferrovial IR</div><div id="cal-list" class="mt8">${loading()}</div></div>
       <div class="card" id="cal-notes"></div>
     </div>`;

  const baseline = await data('calendar-baseline.json').catch(() => ({ events: [], reportingNotes: [] }));
  let live = [];
  try { const d = await api('calendar'); live = (d.events || []).filter((e) => e.date); } catch { /* ignore */ }

  const today = new Date().toISOString().slice(0, 10);
  const merged = [...(baseline.events || []), ...live.map((e) => ({ ...e, estimate: false, source: 'Yahoo' }))]
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // de-dup near-identical (same month + type)
  const seen = new Set();
  const events = merged.filter((e) => { const k = e.type + '|' + e.date.slice(0, 7); if (seen.has(k)) return false; seen.add(k); return true; });

  document.getElementById('cal-list').innerHTML = events.length ? `<div class="tl">${events.map((e) => `
    <div class="tl-item">
      <div class="d">${fmt.date(e.date, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })} ${e.estimate ? '<span class="tag">▲ est.</span>' : '<span class="tag" style="background:var(--green-l);color:#0c6e3e">live</span>'}</div>
      <div class="ti">${esc(e.title)} <span class="pill" style="font-size:11px">${esc(e.type)}</span></div>
    </div>`).join('')}</div>` : '<div class="muted">No upcoming events found.</div>';

  document.getElementById('cal-notes').innerHTML = `<h3>Reporting & disclosure</h3>
    <p class="small">${esc(baseline.cadence || '')}</p>
    <ul class="small">${(baseline.reportingNotes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    ${callout('Reg FD / MAR', 'IR is the guardian of fair disclosure: quiet periods precede each release, and nothing material non-public is shared selectively in meetings, NDRs or calls.')}`;
}
