// Chart.js (UMD global `Chart`) helpers. Each helper destroys any prior chart
// bound to the same canvas before drawing.
const registry = new WeakMap();

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
const GRID = '#eef0f3';
const YELLOW = '#F2B705', GREEN = '#159a5b', RED = '#df3b3b', INK = '#1c2230', GRAY = '#aeb6c0';

function destroy(canvas) { const c = registry.get(canvas); if (c) { c.destroy(); registry.delete(canvas); } }
function keep(canvas, chart) { registry.set(canvas, chart); return chart; }

const baseOpts = (yFmt) => ({
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#fff', titleColor: INK, bodyColor: INK, borderColor: '#e6e8ec', borderWidth: 1,
      padding: 10, titleFont: { family: FONT, weight: '700' }, bodyFont: { family: FONT },
      callbacks: yFmt ? { label: (ctx) => `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${yFmt(ctx.parsed.y)}` } : {}
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: FONT, size: 11 }, color: GRAY, maxTicksLimit: 8, maxRotation: 0 } },
    y: { grid: { color: GRID }, border: { display: false }, ticks: { font: { family: FONT, size: 11 }, color: GRAY, callback: (v) => yFmt ? yFmt(v) : v } }
  }
});

// Single price area chart. points: [{t,c}]
export function priceArea(canvas, points, { yFmt, color } = {}) {
  destroy(canvas);
  const labels = points.map((p) => p.t);
  const vals = points.map((p) => p.c);
  const up = vals.length > 1 ? vals[vals.length - 1] >= vals[0] : true;
  const line = color || (up ? GREEN : RED);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
  grad.addColorStop(0, hexA(line, 0.22)); grad.addColorStop(1, hexA(line, 0.0));
  return keep(canvas, new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: vals, borderColor: line, backgroundColor: grad, borderWidth: 2, fill: true, pointRadius: 0, tension: 0.18 }] },
    options: withTimeTicks(baseOpts(yFmt), labels)
  }));
}

// Multi-line (e.g. close + SMAs). datasets: [{label,data,color,width,dash}]
export function multiLine(canvas, labels, datasets, { yFmt, legend = true } = {}) {
  destroy(canvas);
  const o = baseOpts(yFmt);
  o.plugins.legend = { display: legend, position: 'top', align: 'end', labels: { font: { family: FONT, size: 11 }, color: '#6b7280', boxWidth: 14, usePointStyle: true } };
  return keep(canvas, new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: datasets.map((d) => ({ label: d.label, data: d.data, borderColor: d.color, backgroundColor: d.color, borderWidth: d.width || 1.6, borderDash: d.dash || [], pointRadius: 0, tension: 0.15, spanGaps: true })) },
    options: withTimeTicks(o, labels)
  }));
}

// Simple bar chart. items: [{label,value,color,self}]
export function barChart(canvas, items, { yFmt, horizontal = false } = {}) {
  destroy(canvas);
  const o = baseOpts(yFmt);
  if (horizontal) o.indexAxis = 'y';
  return keep(canvas, new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: items.map((i) => i.label),
      datasets: [{
        data: items.map((i) => i.value),
        backgroundColor: items.map((i) => i.self ? YELLOW : (i.color || GRAY)),
        borderRadius: 5, maxBarThickness: 46
      }]
    },
    options: o
  }));
}

function withTimeTicks(o, labels) {
  // Pretty x labels: show date-ish strings compactly.
  o.scales.x.ticks.callback = function (val, idx) {
    const raw = labels[idx]; if (!raw) return '';
    const s = String(raw);
    if (s.includes('T') && s.length > 16) return s.slice(11, 16);           // intraday HH:MM
    if (s.length >= 10) { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' }); }
    return s;
  };
  return o;
}

function hexA(hex, a) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const COLORS = { YELLOW, GREEN, RED, INK, GRAY };
