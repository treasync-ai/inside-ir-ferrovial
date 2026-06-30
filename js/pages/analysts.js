import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, stat, loading, errBox } from '../ui.js';

// Map any broker rating string to a normalized bucket + color.
function bucket(grade) {
  const g = (grade || '').toLowerCase();
  if (/strong buy|conviction buy/.test(g)) return { k: 'strongBuy', label: 'Strong Buy', c: '#0f8a4d', t: '#fff' };
  if (/buy|overweight|outperform|accumulate|add|positive/.test(g)) return { k: 'buy', label: grade || 'Buy', c: '#5cb87a', t: '#0b3d22' };
  if (/hold|neutral|market perform|sector perform|equal.?weight|peer perform|in.?line/.test(g)) return { k: 'hold', label: grade || 'Hold', c: '#f2c94c', t: '#5a4500' };
  if (/underperform|underweight|reduce|sell|negative/.test(g)) return { k: 'sell', label: grade || 'Sell', c: '#e2614d', t: '#fff' };
  return { k: 'na', label: grade || 'N/R', c: '#d3d8de', t: '#3a4250' };
}

export default async function render(root) {
  root.innerHTML = pageHead('Analyst coverage',
    'The sell-side view on Ferrovial: recommendation consensus, price-target range, and the covering analysts as a rating heatmap.') +
    `<div id="an-top" class="grid g-2-1 mb">${loading('Loading analyst data…')}</div>
     <div class="card"><div class="spread mb"><h3>Covering analysts</h3><div class="card-sub" id="an-firms-sub"></div></div>
       <div id="an-heatmap">${loading('Loading firms…')}</div></div>`;

  const [a, curated] = await Promise.all([
    api('analysts').catch(() => null),
    data('analysts-curated.json').catch(() => ({ firms: [] }))
  ]);

  if (!a || !a.distribution) {
    document.getElementById('an-top').innerHTML = errBox('Analyst data is refreshing — check back shortly.');
  } else {
    renderTop(a);
  }
  renderHeatmap(a, curated);
}

function renderTop(a) {
  const d = a.distribution;
  const total = a.total || (d.strongBuy + d.buy + d.hold + d.sell + d.strongSell);
  const segs = [
    ['Strong Buy', d.strongBuy, '#0f8a4d'], ['Buy', d.buy, '#5cb87a'],
    ['Hold', d.hold, '#f2c94c'], ['Sell', d.sell, '#e2614d'], ['Strong Sell', d.strongSell, '#b3271a']
  ].filter((s) => s[1] > 0);
  const bar = segs.map((s) => `<div title="${s[0]}: ${s[1]}" style="width:${s[1] / total * 100}%;background:${s[2]}"></div>`).join('');
  const legend = [['Strong Buy', d.strongBuy, '#0f8a4d'], ['Buy', d.buy, '#5cb87a'], ['Hold', d.hold, '#f2c94c'], ['Sell', d.sell, '#e2614d'], ['Strong Sell', d.strongSell, '#b3271a']]
    .map((s) => `<span class="pill" style="font-size:12px"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${s[2]};margin-right:5px"></span>${s[0]}: <b>${s[1]}</b></span>`).join('');

  const pt = a.priceTarget || {};
  const cur = pt.current, lo = pt.low, hi = pt.high, mean = pt.mean;
  const pct = (v) => (hi && lo && hi > lo) ? Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)) : 50;

  document.getElementById('an-top').innerHTML = `
    <div class="card">
      <h3>Recommendation consensus</h3>
      <div class="spread" style="align-items:flex-end;margin:8px 0 6px">
        <div><span class="pill y" style="font-size:14px">${esc(a.consensusLabel)}</span></div>
        <div class="small muted">${total} analysts · mean score ${fmt.num(a.consensusScore, 2)}/5</div>
      </div>
      <div style="display:flex;height:22px;border-radius:7px;overflow:hidden;border:1px solid var(--line)">${bar}</div>
      <div class="row" style="gap:7px;margin-top:10px">${legend}</div>
    </div>
    <div class="card">
      <h3>Price target</h3><div class="card-sub">12-month, ${esc(pt.currency || 'EUR')}</div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 12px">
        ${stat('Mean target', fmt.money(mean, pt.currency, 2), pt.upsidePct != null ? 'upside ' + fmt.pct(pt.upsidePct) : '')}
        ${stat('Current', fmt.money(cur, pt.currency, 2))}
      </div>
      <div style="position:relative;height:14px;border-radius:999px;background:linear-gradient(90deg,#e2614d,#f2c94c,#5cb87a)">
        ${cur != null ? `<div title="Current ${fmt.money(cur, pt.currency, 2)}" style="position:absolute;top:-4px;left:${pct(cur)}%;width:3px;height:22px;background:#1c2230;transform:translateX(-50%)"></div>` : ''}
        ${mean != null ? `<div title="Mean ${fmt.money(mean, pt.currency, 2)}" style="position:absolute;top:-7px;left:${pct(mean)}%;width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid #1c2230;transform:translate(-50%,0)"></div>` : ''}
      </div>
      <div class="spread small muted" style="margin-top:6px"><span>Low ${fmt.money(lo, pt.currency, 0)}</span><span>High ${fmt.money(hi, pt.currency, 0)}</span></div>
    </div>`;
}

function renderHeatmap(a, curated) {
  // Merge curated firm list with live rating changes (by firm name).
  const live = {};
  (a?.actions || []).forEach((x) => { live[x.firm.toLowerCase()] = x; });
  const firms = (curated.firms || []).map((f) => {
    const lv = live[f.firm.toLowerCase()];
    return lv ? { firm: f.firm, grade: lv.grade || f.grade, target: lv.target ?? f.target, date: lv.date || f.date, live: true } : { ...f, live: false };
  });
  // append any live firms not in the curated list
  (a?.actions || []).forEach((x) => {
    if (!firms.some((f) => f.firm.toLowerCase() === x.firm.toLowerCase()))
      firms.push({ firm: x.firm, grade: x.grade, target: x.target, date: x.date, live: true });
  });

  document.getElementById('an-firms-sub').textContent = `${firms.length} firms · live changes flagged · indicative ratings ~mid-2026`;
  document.getElementById('an-heatmap').innerHTML =
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px">${
      firms.map((f) => {
        const b = bucket(f.grade);
        return `<div style="border-radius:10px;padding:11px 13px;background:${b.c};color:${b.t};box-shadow:var(--shadow)">
          <div style="font-weight:700;font-size:13.5px">${esc(f.firm)}${f.live ? ' <span style="font-size:10px;opacity:.8">●live</span>' : ''}</div>
          <div style="font-size:13px;margin-top:2px">${esc(b.label)}</div>
          <div style="font-size:11.5px;opacity:.85;margin-top:3px">${f.target ? 'PT ' + fmt.money(f.target, 'EUR', 0) : ''}${f.date ? ' · ' + esc(String(f.date)) : ''}</div>
        </div>`;
      }).join('')}</div>
     <div class="small muted" style="margin-top:10px">Recommendation distribution &amp; price target are live (Yahoo Finance). The firm grid blends Ferrovial's known covering analysts (indicative, ~mid-2026) with live rating changes (flagged ●live). Verify against Ferrovial IR before quoting.</div>`;
}
