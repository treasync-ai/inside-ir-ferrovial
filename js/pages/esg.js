import { data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, stat, loading, errBox, callout } from '../ui.js';

const bandColor = (b) => b === 'leader' ? { c: '#0f8a4d', t: '#fff' } : b === 'good' ? { c: '#5cb87a', t: '#0b3d22' }
  : b === 'medium' ? { c: '#f2c94c', t: '#5a4500' } : { c: '#d3d8de', t: '#3a4250' };

export default async function render(root) {
  root.innerHTML = pageHead('ESG & sustainability',
    'Ferrovial’s 2030 strategy, SBTi-validated decarbonisation targets and third-party ESG ratings — the proof points IR uses with investors.') +
    `<div id="esg-body">${loading('Loading ESG…')}</div>`;

  const e = await data('esg.json').catch(() => null);
  if (!e) { document.getElementById('esg-body').innerHTML = errBox('esg.json not found.'); return; }

  const p = e.targets.progress;
  const reduction = p.baseline2020 && p.latest ? (1 - p.latest / p.baseline2020) * 100 : null;

  document.getElementById('esg-body').innerHTML = `
    <div class="card mb">
      <h3>${esc(e.strategy.name)} <span class="pill y" style="font-size:11px">${esc(e.strategy.framework)}</span></h3>
      <div class="grid g3 mt8">
        ${e.strategy.pillars.map((pi) => `<div class="card tight"><b>${esc(pi.name)}</b><p class="small muted" style="margin:4px 0 0">${esc(pi.desc)}</p></div>`).join('')}
      </div>
    </div>

    <div class="grid g2 mb">
      <div class="card">
        <h3>Decarbonisation targets</h3><div class="card-sub">${esc(e.targets.validation)}</div>
        <div class="tbl-wrap" style="box-shadow:none;margin-top:8px"><table class="data"><thead><tr><th style="text-align:left">KPI</th><th style="text-align:left">Target</th></tr></thead>
          <tbody>${e.targets.items.map((t) => `<tr><td style="text-align:left">${esc(t.kpi)}</td><td style="text-align:left"><b>${esc(t.target)}</b>${t.vs ? ` <span class="muted small">vs ${esc(t.vs)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="card">
        <h3>Emissions progress</h3><div class="card-sub">${esc(p.metric)} · ${esc(p.unit)}</div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:10px 0">
          ${stat('2020 baseline', fmt.int(p.baseline2020))}
          ${stat('Latest', fmt.int(p.latest), reduction != null ? '−' + fmt.num(reduction, 0) + '% vs 2020' : '')}
        </div>
        <div style="height:14px;border-radius:8px;background:var(--grayfill);overflow:hidden">
          <div style="height:100%;width:${reduction != null ? Math.min(100, reduction) : 0}%;background:linear-gradient(90deg,#5cb87a,#0f8a4d)"></div>
        </div>
        <div class="small muted" style="margin-top:6px">On track toward the −42% Scope 1&amp;2 goal by 2030.</div>
      </div>
    </div>

    <div class="card mb">
      <h3>ESG ratings</h3><div class="card-sub">Third-party assessments · verify latest before external use</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:10px">
        ${e.ratings.map((r) => { const cl = bandColor(r.band); return `<div style="border-radius:10px;padding:12px 14px;background:${cl.c};color:${cl.t};box-shadow:var(--shadow)">
          <div style="font-size:12px;opacity:.9">${esc(r.provider)}</div>
          <div style="font-weight:800;font-size:17px;margin-top:2px">${esc(r.value)}</div>
          <div style="font-size:11px;opacity:.85;margin-top:2px">${esc(r.scale)}</div></div>`; }).join('')}
      </div>
    </div>

    <div class="grid g2">
      ${callout('Sustainability-linked financing', esc(e.financing))}
      ${callout('Reporting', esc(e.reporting), 'gray')}
    </div>
    <div class="small muted" style="margin-top:10px">${esc(e.note)}</div>`;
}
