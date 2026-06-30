// Formatting + small DOM helpers shared across pages.

export const CCY = { USD: '$', EUR: '€', AUD: 'A$', GBP: '£', CAD: 'C$' };
export const ccy = (c) => CCY[c] || (c ? c + ' ' : '');

const n = (v) => (v === null || v === undefined || Number.isNaN(v)) ? null : Number(v);

export const fmt = {
  money(v, c = 'EUR', d = 2) {
    const x = n(v); if (x === null) return '—';
    return ccy(c) + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  num(v, d = 2) {
    const x = n(v); if (x === null) return '—';
    return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  int(v) {
    const x = n(v); if (x === null) return '—';
    return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
  },
  compact(v, c = '') {
    const x = n(v); if (x === null) return '—';
    const a = Math.abs(x);
    const s = a >= 1e12 ? (x / 1e12).toFixed(2) + 'T'
            : a >= 1e9 ? (x / 1e9).toFixed(2) + 'B'
            : a >= 1e6 ? (x / 1e6).toFixed(2) + 'M'
            : a >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : x.toFixed(0);
    return (c ? ccy(c) : '') + s;
  },
  // €m values (already in millions)
  millions(v) {
    const x = n(v); if (x === null) return '—';
    const a = Math.abs(x);
    return a >= 1000 ? '€' + (x / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'bn'
                     : '€' + x.toLocaleString('en-US', { maximumFractionDigits: 0 }) + 'm';
  },
  pct(v, d = 2, sign = true) {
    const x = n(v); if (x === null) return '—';
    return (sign && x > 0 ? '+' : '') + x.toFixed(d) + '%';
  },
  pctHTML(v, d = 2) {
    const x = n(v); if (x === null) return '<span class="flat">—</span>';
    const cls = x > 0.0001 ? 'up' : x < -0.0001 ? 'down' : 'flat';
    const arrow = x > 0.0001 ? '▲' : x < -0.0001 ? '▼' : '◆';
    return `<span class="${cls}">${arrow} ${(x > 0 ? '+' : '')}${x.toFixed(d)}%</span>`;
  },
  date(iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
    if (!iso) return '—';
    const dt = new Date(iso); if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('en-GB', opts);
  },
  ago(iso) {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  }
};

export const signClass = (v) => (v > 0.0001 ? 'up' : v < -0.0001 ? 'down' : 'flat');

// Minimal DOM builder. el('div', {class:'x'}, [child, 'text'])
export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}

export const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
