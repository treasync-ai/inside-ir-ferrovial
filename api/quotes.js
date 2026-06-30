// GET /api/quotes → quotes for Ferrovial's three listings + momentum sentiment.
// Uses Yahoo's crumbless chart endpoint (works from serverless IPs); Finnhub as
// a fallback for the US line when a key is configured.
import { FERROVIAL, SHARES } from './_lib/config.js';
import { quoteFromChart, chart } from './_lib/yahooRest.js';
import { finnhubEnabled, finnhubQuote } from './_lib/finnhub.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';

function closeAgo(series, bars) {
  const i = series.length - 1 - bars;
  return i >= 0 ? series[i].close : (series[0]?.close ?? null);
}

async function momentumSentiment() {
  try {
    const { meta, series } = await chart(FERROVIAL.primary, { range: '6mo', interval: '1d' });
    if (series.length < 25) return null;
    const last = series[series.length - 1].close;
    const r1m = (last / closeAgo(series, 21) - 1) * 100;
    const r3m = (last / closeAgo(series, 63) - 1) * 100;
    const hi = meta.fiftyTwoWeekHigh, lo = meta.fiftyTwoWeekLow;
    const pos = (hi && lo && hi > lo) ? (last - lo) / (hi - lo) : 0.5;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let index = 50 + clamp(r3m, -20, 20) / 20 * 25 + clamp(r1m, -10, 10) / 10 * 15 + (pos - 0.5) * 20;
    index = Math.round(Math.max(0, Math.min(100, index)));
    const label = index >= 70 ? 'Bullish' : index >= 58 ? 'Moderately bullish'
      : index >= 42 ? 'Neutral' : index >= 30 ? 'Moderately bearish' : 'Bearish';
    return { index, label, basis: 'momentum', r1m, r3m, pos52: pos * 100, week52High: hi, week52Low: lo, price: last, currency: meta.currency };
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const data = await withCache('quotes:v2', 60, async () => {
      const listings = await Promise.all(FERROVIAL.listings.map(async (l) => {
        let q = null;
        try { q = await quoteFromChart(l.symbol); }
        catch {
          if (l.key === 'US' && finnhubEnabled()) { try { q = await finnhubQuote('FER'); } catch { /* */ } }
        }
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
      const sentiment = await momentumSentiment();
      return { listings, sentiment };
    });
    return ok(res, data, { cdnSeconds: 60, swr: 900 });
  } catch (err) {
    return fail(res, 502, 'Could not load quotes', { detail: String(err?.message || err) });
  }
}
