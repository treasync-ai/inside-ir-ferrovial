// GET /api/technicals?symbol=FER.MC → RSI(14), SMA(20/50/200) + overlay series.
// Provider: Twelve Data → Yahoo REST.
import { tdEnabled, tdSeries } from './_lib/twelvedata.js';
import { chart, technicals } from './_lib/yahooRest.js';
import { withCache } from './_lib/cache.js';
import { ok, fail, qp } from './_lib/http.js';
import { FERROVIAL } from './_lib/config.js';

const VALID = new Set(['FER', 'FER.MC', 'FER.AS']);
const rollSMA = (a, n) => a.map((_, i) => i + 1 >= n ? a.slice(i + 1 - n, i + 1).reduce((x, y) => x + y, 0) / n : null);
const rollRSI = (c, n = 14) => c.map((_, i) => {
  if (i < n) return null;
  let g = 0, l = 0;
  for (let k = i - n + 1; k <= i; k++) { const d = c[k] - c[k - 1]; if (d >= 0) g += d; else l -= d; }
  const avgL = l / n; if (avgL === 0) return 100;
  return 100 - 100 / (1 + (g / n) / avgL);
});

async function getPoints(symbol) {
  if (tdEnabled()) {
    try { const r = await tdSeries(symbol, { interval: '1day', outputsize: 520 }); return { series: r.series, currency: r.currency }; }
    catch { /* */ }
  }
  const c = await chart(symbol, { range: '2y', interval: '1d' });
  return { series: c.series, currency: c.meta?.currency };
}

export default async function handler(req, res) {
  const symbol = VALID.has(qp(req, 'symbol')) ? qp(req, 'symbol') : FERROVIAL.primary;
  try {
    const data = await withCache(`tech:${symbol}`, 60 * 30, async () => {
      const { series: pts, currency } = await getPoints(symbol);
      const closes = pts.filter((p) => p.close != null).map((p) => p.close);
      const dates = pts.filter((p) => p.close != null).map((p) => p.date);
      const sma20 = rollSMA(closes, 20), sma50 = rollSMA(closes, 50), sma200 = rollSMA(closes, 200), rsi = rollRSI(closes, 14);
      const ind = technicals(closes);
      const trend = (ind.sma50 && ind.sma200) ? (ind.sma50 > ind.sma200 ? 'Uptrend (50d > 200d)' : 'Downtrend (50d < 200d)') : null;
      const rsiState = ind.rsi14 == null ? null : ind.rsi14 >= 70 ? 'Overbought' : ind.rsi14 <= 30 ? 'Oversold' : 'Neutral';
      const vsSma200 = (ind.price && ind.sma200) ? ((ind.price - ind.sma200) / ind.sma200) * 100 : null;
      const seriesOut = dates.map((d, i) => ({ t: d.toISOString().slice(0, 10), c: closes[i], sma20: sma20[i], sma50: sma50[i], sma200: sma200[i], rsi: rsi[i] })).slice(-300);
      return { symbol, currency, indicators: { ...ind, trend, rsiState, vsSma200 }, series: seriesOut };
    });
    return ok(res, data, { cdnSeconds: 600, swr: 1800 });
  } catch (err) {
    return fail(res, 502, 'Could not load technicals', { detail: String(err?.message || err) });
  }
}
