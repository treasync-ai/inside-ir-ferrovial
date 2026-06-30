// GET /api/technicals?symbol=FER.MC
// RSI(14), SMA(20/50/200), EMA(20/50) from ~14 months of daily closes,
// plus a series with SMA overlays for charting.
import { chart, technicals } from './_lib/yahoo.js';
import { withCache } from './_lib/cache.js';
import { ok, fail, qp } from './_lib/http.js';
import { FERROVIAL } from './_lib/config.js';

const VALID = new Set(['FER', 'FER.MC', 'FER.AS']);

const rollingSMA = (arr, n) => arr.map((_, i) =>
  i + 1 >= n ? arr.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n : null);

const rollingRSI = (closes, n = 14) => closes.map((_, i) => {
  if (i < n) return null;
  let g = 0, l = 0;
  for (let k = i - n + 1; k <= i; k++) { const d = closes[k] - closes[k - 1]; if (d >= 0) g += d; else l -= d; }
  const avgL = l / n; if (avgL === 0) return 100;
  return 100 - 100 / (1 + (g / n) / avgL);
});

export default async function handler(req, res) {
  const symbol = VALID.has(qp(req, 'symbol')) ? qp(req, 'symbol') : FERROVIAL.primary;
  try {
    const data = await withCache(`tech:${symbol}`, 60 * 30, async () => {
      const c = await chart(symbol, { period1: new Date(Date.now() - 430 * 86400000), interval: '1d' });
      const pts = (c.quotes || []).filter((q) => q.close != null).map((q) => ({ date: new Date(q.date), close: q.close }));
      const closes = pts.map((p) => p.close);
      const sma20 = rollingSMA(closes, 20), sma50 = rollingSMA(closes, 50), sma200 = rollingSMA(closes, 200);
      const rsi = rollingRSI(closes, 14);
      const ind = technicals(closes);

      // signal interpretation
      const price = ind.price;
      const trend = (ind.sma50 && ind.sma200)
        ? (ind.sma50 > ind.sma200 ? 'Uptrend (50d > 200d)' : 'Downtrend (50d < 200d)') : null;
      const rsiState = ind.rsi14 == null ? null
        : ind.rsi14 >= 70 ? 'Overbought' : ind.rsi14 <= 30 ? 'Oversold' : 'Neutral';
      const vsSma200 = (price && ind.sma200) ? ((price - ind.sma200) / ind.sma200) * 100 : null;

      const series = pts.map((p, i) => ({
        t: p.date.toISOString().slice(0, 10), c: p.close,
        sma20: sma20[i], sma50: sma50[i], sma200: sma200[i], rsi: rsi[i]
      })).slice(-300);

      return { symbol, currency: c.meta?.currency, indicators: { ...ind, trend, rsiState, vsSma200 }, series };
    });
    return ok(res, data, { cdnSeconds: 300, swr: 1800 });
  } catch (err) {
    return fail(res, 502, 'Could not load technicals', { detail: String(err?.message || err) });
  }
}
