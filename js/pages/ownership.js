import { data } from '../api.js';
import { fmt, esc } from '../util.js';
import { pageHead, stat, loading, errBox, callout } from '../ui.js';
import { barChart, COLORS } from '../charts.js';

export default async function render(root) {
  root.innerHTML = pageHead('Ownership',
    'Shareholder register, free float, the geographic investor base and governance — the heart of investor targeting.') +
    `<div id="own-body">${loading('Loading ownership…')}</div>`;

  const o = await data('ownership.json').catch(() => null);
  if (!o) { document.getElementById('own-body').innerHTML = errBox('ownership.json not found.'); return; }

  const palette = ['#c98a00', '#2c6cb0', '#e0a92a', '#7a5cff', '#d3d8de'];
  const comp = o.holders.map((h, i) => `<div title="${esc(h.name)}: ${h.pct}%" style="width:${h.pct}%;background:${palette[i % palette.length]}"></div>`).join('');
  const holderRows = o.holders.map((h, i) =>
    `<tr><td style="text-align:left"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${palette[i % palette.length]};margin-right:7px"></span>${esc(h.name)}</td>
      <td>${fmt.num(h.pct, 2)}%</td><td style="text-align:left" class="muted small">${esc(h.type)}</td></tr>`).join('');

  document.getElementById('own-body').innerHTML = `
    <div class="grid g4 mb">
      ${stat('Founding family', o.familyAggregate, 'del Pino, aggregate')}
      ${stat('Free float', fmt.num(o.holders.find((h) => /free float/i.test(h.name))?.pct, 1) + '%')}
      ${stat('Largest non-family', 'TCI 10.0%', 'The Children\'s Investment Fund')}
      ${stat('Shares outstanding', fmt.compact(o.sharesOutstanding), 'ordinary')}
    </div>

    <div class="card mb">
      <h3>Register composition</h3><div class="card-sub">As disclosed to the AFM · ${fmt.date(o.asOf)}</div>
      <div style="display:flex;height:26px;border-radius:8px;overflow:hidden;border:1px solid var(--line);margin:8px 0 12px">${comp}</div>
      <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr><th style="text-align:left">Holder</th><th>Stake</th><th style="text-align:left">Type</th></tr></thead><tbody>${holderRows}</tbody></table></div>
    </div>

    <div class="grid g2 mb">
      <div class="card">
        <h3>Geographic investor base</h3><div class="card-sub">${esc(o.geographic.asOf)}</div>
        <div class="chart-box" style="height:220px"><canvas id="own-geo"></canvas></div>
      </div>
      <div class="card">
        <h3>US investor-base expansion</h3>
        <p class="small">${esc(o.usBase)}</p>
        ${callout('Why it matters', 'The whole rationale of the Netherlands move + Nasdaq listing was to grow the US register. North America at ~27% of the institutional base is the KPI this platform helps IR track and grow.')}
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>Governance</h3>
        <ul class="small">
          <li><b>Chairman:</b> ${esc(o.governance.chairman)}</li>
          <li><b>CEO:</b> ${esc(o.governance.ceo)}</li>
          <li><b>Board:</b> ${esc(o.governance.board)}</li>
          <li><b>Voting:</b> ${esc(o.governance.votingRights)}</li>
          <li><b>Domicile:</b> ${esc(o.governance.domicile)}</li>
        </ul>
      </div>
      <div class="card">
        <h3>Capital &amp; listings</h3>
        <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr><th style="text-align:left">Market</th><th style="text-align:left">Ticker</th><th>Ccy</th><th>Since</th></tr></thead>
          <tbody>${o.capital.listings.map((l) => `<tr><td style="text-align:left">${esc(l.market)}</td><td style="text-align:left">${esc(l.ticker)}</td><td>${esc(l.currency)}</td><td>${esc(String(l.since))}</td></tr>`).join('')}</tbody></table></div>
        <p class="small" style="margin-top:8px"><b>Buyback:</b> ${esc(o.capital.buyback)}</p>
        <p class="small"><b>Dividend:</b> ${esc(o.capital.dividend)}</p>
      </div>
    </div>`;

  barChart(document.getElementById('own-geo'),
    o.geographic.split.map((g) => ({ label: g.region, value: g.pct, self: /north america/i.test(g.region) })),
    { yFmt: (v) => v + '%', horizontal: true });
}
