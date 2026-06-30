// Reusable UI fragments shared by the pages. Returns HTML strings or elements.
import { fmt, ccy, esc } from './util.js';

export const pageHead = (title, sub) =>
  `<div class="page-head"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;

export const loading = (txt = 'Loading live data…') => `<div class="loading">${esc(txt)}</div>`;
export const errBox = (msg) => `<div class="err">${esc(msg)}</div>`;

export const card = (inner, cls = '') => `<div class="card ${cls}">${inner}</div>`;

export const stat = (label, valueHTML, sub = '') =>
  `<div class="card tight stat"><div class="label">${esc(label)}</div><div class="val">${valueHTML}</div>${sub ? `<div class="small muted" style="margin-top:2px">${sub}</div>` : ''}</div>`;

export function changeHTML(change, pct, c = 'EUR') {
  if (change == null && pct == null) return '<span class="flat">—</span>';
  const up = (pct ?? change) > 0, down = (pct ?? change) < 0;
  const cls = up ? 'up' : down ? 'down' : 'flat';
  const arrow = up ? '▲' : down ? '▼' : '◆';
  const ch = change != null ? `${up ? '+' : ''}${fmt.num(change, 2)} ` : '';
  const pc = pct != null ? `(${up ? '+' : ''}${fmt.num(pct, 2)}%)` : '';
  return `<span class="${cls}">${arrow} ${ch}${pc}</span>`;
}

export function listingCard(l) {
  const rng = (l.week52Low != null && l.week52High != null)
    ? `${fmt.num(l.week52Low, 2)} – ${fmt.num(l.week52High, 2)}` : '—';
  return `<div class="listing">
    <div class="spread">
      <div><span class="flag">${l.flag || ''}</span> <b>${esc(l.market)}</b><div class="mk">${esc(l.symbol)} · ${l.currency}</div></div>
      <span class="tag">${esc(l.marketState || '')}</span>
    </div>
    <div class="px">${fmt.money(l.price, l.currency, 2)}</div>
    <div class="chg">${changeHTML(l.change, l.changePercent, l.currency)}</div>
    <table><tbody>
      <tr><td>Open</td><td class="v">${fmt.num(l.open, 2)}</td><td>Prev close</td><td class="v">${fmt.num(l.prevClose, 2)}</td></tr>
      <tr><td>Day high</td><td class="v">${fmt.num(l.dayHigh, 2)}</td><td>Day low</td><td class="v">${fmt.num(l.dayLow, 2)}</td></tr>
      <tr><td>Volume</td><td class="v">${fmt.int(l.volume)}</td><td>Mkt cap</td><td class="v">${fmt.compact(l.marketCap, l.currency)}</td></tr>
      <tr><td>52-wk range</td><td class="v" colspan="3">${rng}</td></tr>
    </tbody></table>
  </div>`;
}

// returns object { '1d':..., '1w':... } → row of pill stats
export function returnsStrip(returns) {
  const keys = [['1d', '1D'], ['1w', '1W'], ['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['ytd', 'YTD'], ['1y', '1Y'], ['5y', '5Y']];
  return `<div class="row" style="gap:10px">${keys.map(([k, lab]) => {
    const v = returns?.[k];
    return `<div class="card tight" style="flex:1;min-width:88px"><div class="label">${lab}</div><div class="val" style="font-size:16px">${fmt.pctHTML(v)}</div></div>`;
  }).join('')}</div>`;
}

export const callout = (title, body, kind = '') =>
  `<div class="callout ${kind}"><div class="h">${esc(title)}</div>${body}</div>`;
