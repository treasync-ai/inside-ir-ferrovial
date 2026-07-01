import { data, api } from '../api.js';
import { esc } from '../util.js';
import { pageHead, loading, callout } from '../ui.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function render(root) {
  root.innerHTML = pageHead('Financial calendar',
    'Ferrovial IR events — results releases, conference calls, roadshows and conferences.') +
    `<div class="grid g-2-1">
       <div id="cal-list">${loading()}</div>
       <div class="card" id="cal-notes" style="align-self:start"></div>
     </div>`;

  const baseline = await data('calendar-baseline.json').catch(() => ({ events: [], reportingNotes: [] }));
  let live = [];
  try { const d = await api('calendar'); live = (d.events || []).filter((e) => e.date); } catch { /* curated only */ }

  const today = new Date().toISOString().slice(0, 10);
  const all = [...(baseline.events || []), ...live.map((e) => ({ ...e, category: e.category || 'results' }))]
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.title).localeCompare(String(b.title)));

  document.getElementById('cal-list').innerHTML = all.length ? renderMonths(all)
    : '<div class="card"><div class="muted">No upcoming events.</div></div>';

  document.getElementById('cal-notes').innerHTML = `<h3>Reporting &amp; disclosure</h3>
    <p class="small">${esc(baseline.cadence || '')}</p>
    <ul class="small">${(baseline.reportingNotes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    ${callout('Reg FD / MAR', 'IR is the guardian of fair disclosure: quiet periods precede each results release, and nothing material non-public is shared selectively in meetings, NDRs or calls.')}`;
}

function renderMonths(events) {
  const groups = {};
  events.forEach((e) => {
    const d = new Date(e.date + 'T00:00:00Z');
    const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth()).padStart(2, '0');
    (groups[key] ||= []).push(e);
  });
  return Object.keys(groups).sort().map((key) => {
    const [y, m] = key.split('-');
    return `<div class="card mb"><h3 style="margin-bottom:8px">${MONTHS[+m]} ${y}</h3>${groups[key].map(evRow).join('')}</div>`;
  }).join('');
}

function evRow(e) {
  const d = new Date(e.date + 'T00:00:00Z');
  const day = d.getUTCDate(), wd = WD[d.getUTCDay()], yr = d.getUTCFullYear();
  const mo = MONTHS[d.getUTCMonth()].slice(0, 3).toUpperCase();
  const cat = e.category === 'roadshow' ? { label: 'Roadshows & Conferences', c: '#2c6cb0' } : { label: 'Financial calendar', c: '#c98a00' };
  return `<div style="display:flex;gap:14px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line2)">
    <div style="flex:0 0 auto;width:58px;text-align:center;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff">
      <div style="background:var(--yellow);color:#1c2230;font-size:10px;font-weight:700;padding:2px 0">${mo}-${String(yr).slice(2)}</div>
      <div style="font-size:19px;font-weight:800;line-height:1.05;padding-top:4px">${day}</div>
      <div style="font-size:10px;color:var(--muted);padding-bottom:4px">${wd}</div>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600">${esc(e.title)}</div>
      <div class="small muted" style="margin-top:2px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${cat.c};margin-right:6px"></span>${cat.label}${e.location ? ' · ' + esc(e.location) : ''}
      </div>
    </div>
  </div>`;
}
