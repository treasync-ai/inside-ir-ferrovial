import { api, data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, stat, loading, errBox } from '../ui.js';

// Map a recommendation bucket/string to color.
function color(rec, bk) {
  const b = bk || (() => {
    const g = (rec || '').toLowerCase();
    if (/outperform|buy|overweight|add|accumulate|positive/.test(g)) return 'buy';
    if (/underperform|sell|underweight|reduce|negative/.test(g)) return 'sell';
    return 'hold';
  })();
  return b === 'buy' ? { c: '#3f9d63', t: '#fff' } : b === 'sell' ? { c: '#e2614d', t: '#fff' } : { c: '#f2c94c', t: '#5a4500' };
}

export default async function render(root) {
  root.innerHTML = pageHead('Analyst coverage',
    'The sell-side view on Ferrovial — recommendation consensus, price-target range, and every covering analyst as a rating heatmap.') +
    `<div id="an-top" class="grid g-2-1 mb">${loading('Loading analyst coverage…')}</div>
     <div class="card"><div class="spread mb"><h3>Covering analysts</h3><div class="card-sub" id="an-firms-sub"></div></div>
       <div id="an-heatmap">${loading('Loading firms…')}</div></div>`;

  const [cov, q] = await Promise.all([
    data('analysts-coverage.json').catch(() => null),
    api('quotes').catch(() => null)
  ]);
  if (!cov) { document.getElementById('an-top').innerHTML = errBox('Analyst coverage data not found.'); return; }
  const price = q?.listings?.find((l) => l.symbol === 'FER.MC')?.price ?? null;

  renderTop(cov, price);
  renderHeatmap(cov);
}

function renderTop(cov, price) {
  const s = cov.summary, d = s.distribution, total = s.total;
  const segs = [['Outperform', d.buy, '#3f9d63'], ['Hold', d.hold, '#f2c94c'], ['Underperform', d.sell, '#e2614d']].filter((x) => x[1] > 0);
  const bar = segs.map((x) => `<div title="${x[0]}: ${x[1]}" style="width:${x[1] / total * 100}%;background:${x[2]}"></div>`).join('');
  const legend = [['Outperform', d.buy, '#3f9d63'], ['Hold', d.hold, '#f2c94c'], ['Underperform', d.sell, '#e2614d']]
    .map((x) => `<span class="pill" style="font-size:12px"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${x[2]};margin-right:5px"></span>${x[0]}: <b>${x[1]}</b></span>`).join('');

  const t = s.target, lo = t.low, hi = t.high, mean = t.mean, median = t.median;
  const pct = (v) => (hi && lo && hi > lo) ? Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)) : 50;
  const upMean = (mean && price) ? (mean - price) / price * 100 : null;

  document.getElementById('an-top').innerHTML = `
    <div class="card">
      <h3>Recommendation consensus</h3>
      <div class="spread" style="align-items:flex-end;margin:8px 0 6px">
        <span class="pill y" style="font-size:14px">${esc(s.consensusLabel)}</span>
        <div class="small muted">${total} analysts · Ferrovial IR, ${fmt.date(cov.asOf)}</div>
      </div>
      <div style="display:flex;height:22px;border-radius:7px;overflow:hidden;border:1px solid var(--line)">${bar}</div>
      <div class="row" style="gap:7px;margin-top:10px">${legend}</div>
    </div>
    <div class="card">
      <h3>Price target</h3><div class="card-sub">Consensus, ${esc(cov.currency)}</div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 12px">
        ${stat('Median target', fmt.money(median, cov.currency, 1), upMean != null ? 'mean upside ' + fmt.pct(upMean) : '')}
        ${stat('Current', fmt.money(price, 'EUR', 2))}
      </div>
      <div style="position:relative;height:14px;border-radius:999px;background:linear-gradient(90deg,#e2614d,#f2c94c,#3f9d63)">
        ${price != null ? `<div title="Current ${fmt.money(price, 'EUR', 2)}" style="position:absolute;top:-4px;left:${pct(price)}%;width:3px;height:22px;background:#1c2230;transform:translateX(-50%)"></div>` : ''}
        ${mean != null ? `<div title="Mean ${fmt.money(mean, cov.currency, 1)}" style="position:absolute;top:-7px;left:${pct(mean)}%;width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid #1c2230;transform:translate(-50%,0)"></div>` : ''}
      </div>
      <div class="spread small muted" style="margin-top:6px"><span>Low ${fmt.money(lo, cov.currency, 1)} (${esc(t.lowFirm)})</span><span>High ${fmt.money(hi, cov.currency, 0)} (${esc(t.highFirm)})</span></div>
      <div class="small muted" style="margin-top:4px">Mean ${fmt.money(mean, cov.currency, 1)} · ${esc(t.highFirm)}'s ${fmt.money(hi, cov.currency, 0)} is an outlier (different methodology).</div>
    </div>`;
}

function renderHeatmap(cov) {
  const firms = cov.analysts || [];
  document.getElementById('an-firms-sub').textContent = `${firms.length} firms · source: Ferrovial IR (${fmt.date(cov.asOf)})`;
  document.getElementById('an-heatmap').innerHTML =
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:10px">${
      firms.map((f) => {
        const cl = color(f.recommendation, f.bucket);
        return `<div style="border-radius:10px;padding:11px 13px;background:${cl.c};color:${cl.t};box-shadow:var(--shadow)">
          <div style="font-weight:700;font-size:13.5px">${esc(f.entity)}</div>
          <div style="font-size:11.5px;opacity:.9;margin-top:1px">${esc(f.analyst || '')}</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:5px">
            <span style="font-size:13px;font-weight:600">${esc(f.recommendation)}</span>
            <span style="font-size:13px;font-weight:700">${f.target ? fmt.money(f.target, 'EUR', f.target % 1 ? 1 : 0) : ''}</span>
          </div>
          <div style="font-size:11px;opacity:.8;margin-top:2px">${esc(f.date || '')}</div>
        </div>`;
      }).join('')}</div>
     <div class="small muted" style="margin-top:10px">Source: Ferrovial Investor Relations analyst-coverage list, as of ${fmt.date(cov.asOf)}. Update by dropping a new export into <code>data/sources/</code> and running <code>scripts/build-analysts.py</code>.</div>`;
}
