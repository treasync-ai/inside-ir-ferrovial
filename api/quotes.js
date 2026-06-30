// GET /api/quotes → quotes for Ferrovial's three listings + momentum sentiment.
// Provider order: Twelve Data (server-reliable) → Yahoo REST → Finnhub (US only).
import { FERROVIAL, SHARES } from './_lib/config.js';
import { tdEnabled, tdQuote, tdSeries } from './_lib/twelvedata.js';
import { quoteFromChart, chart } from './_lib/yahooRest.js';
import { finnhubEnabled, finnhubQuote } from './_lib/finnhub.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';

async function quoteFor(l) {
  if (tdEnabled()) { try { return await tdQuote(l.symbol); } catch { /* fall through */ } }
  try { return await quoteFromChart(l.symbol); } catch { /* fall through */ }
  if (l.key === 'US' && finnhubEnabled()) { try { return await finnhubQuote('FER'); } catch { /* */ } }
  return null;
}

const closeAgo = (s, bars) => { const i = s.length - 1 - bars; return i >= 0 ? s[i].close : (s[0]?.close ?? null); };

async function momentumSentiment() {
  try {
    let series, hi, lo;
    if (tdEnabled()) {
      const r = await tdSeries(FERROVIAL.primary, { interval: '1day', outputsize: 140 });
      series = r.series;
      const q = await tdQuote(FERROVIAL.primary).catch(() => null);
      hi = q?.week52High; lo = q?.week52Low;
    } else {
      const c = await chart(FERROVIAL.primary, { range: '6mo', interval: '1d' });
      series = c.series; hi = c.meta.fiftyTwoWeekHigh; lo = c.meta.fiftyTwoWeekLow;
    }
    if (!series || series.length < 25) return null;
    const last = series[series.length - 1].close;
    const r1m = (last / closeAgo(series, 21) - 1) * 100;
    const r3m = (last / closeAgo(series, 63) - 1) * 100;
    const pos = (hi && lo && hi > lo) ? (last - lo) / (hi - lo) : 0.5;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let index = 50 + clamp(r3m, -20, 20) / 20 * 25 + clamp(r1m, -10, 10) / 10 * 15 + (pos - 0.5) * 20;
    index = Math.round(Math.max(0, Math.min(100, index)));
    const label = index >= 70 ? 'Bullish' : index >= 58 ? 'Moderately bullish'
      : index >= 42 ? 'Neutral' : index >= 30 ? 'Moderately bearish' : 'Bearish';
    return { index, label, basis: 'momentum', r1m, r3m, pos52: pos * 100 };
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const data = await withCache('quotes:v3', 60, async () => {
      const listings = await Promise.all(FERROVIAL.listings.map(async (l) => {
        const q = await quoteFor(l);
        const price = q?.price ?? null;
        const shares = SHARES[l.symbol];
        return {
          key: l.key, symbol: l.symbol, market: l.market, currency: q?.currency || l.currency, flag: l.flag, name: 'Ferrovial',
          price, prevClose: q?.prevClose ?? null, open: q?.open ?? null,
          dayHigh: q?.dayHigh ?? null, dayLow: q?.dayLow ?? null, volume: q?.volume ?? null,
          marketCap: (price != null && shares) ? price * shares : null,
          change: q?.change ?? null, changePercent: q?.changePercent ?? null,
          week52High: q?.week52High ?? null, week52Low: q?.week52Low ?? null,
          exchange: q?.exchange || l.market, marketState: q?.marketState || null
        };
      }));
      return { listings, sentiment: await momentumSentiment(), provider: tdEnabled() ? 'twelvedata' : 'yahoo' };
    });
    return ok(res, data, { cdnSeconds: 60, swr: 900 });
  } catch (err) {
    return fail(res, 502, 'Could not load quotes', { detail: String(err?.message || err) });
  }
}
