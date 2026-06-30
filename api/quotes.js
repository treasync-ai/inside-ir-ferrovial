// GET /api/quotes  → live quotes for Ferrovial's three listings + analyst sentiment.
import { FERROVIAL } from './_lib/config.js';
import { quoteMany, summary } from './_lib/yahoo.js';
import { finnhubEnabled, finnhubQuote } from './_lib/finnhub.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';

const symbols = FERROVIAL.listings.map((l) => l.symbol);

function mapQuote(l, q) {
  return {
    key: l.key, symbol: l.symbol, market: l.market, currency: q?.currency || l.currency,
    flag: l.flag, name: 'Ferrovial',
    price: q?.regularMarketPrice ?? null,
    prevClose: q?.regularMarketPreviousClose ?? null,
    open: q?.regularMarketOpen ?? null,
    dayHigh: q?.regularMarketDayHigh ?? null,
    dayLow: q?.regularMarketDayLow ?? null,
    volume: q?.regularMarketVolume ?? null,
    marketCap: q?.marketCap ?? null,
    change: q?.regularMarketChange ?? null,
    changePercent: q?.regularMarketChangePercent ?? null,
    week52High: q?.fiftyTwoWeekHigh ?? null,
    week52Low: q?.fiftyTwoWeekLow ?? null,
    exchange: q?.fullExchangeName ?? l.market,
    marketState: q?.marketState ?? null
  };
}

function sentimentFrom(rec, fin, price) {
  const t = rec?.trend?.[0];
  let recScore = null, dist = null;
  if (t) {
    const total = (t.strongBuy + t.buy + t.hold + t.sell + t.strongSell) || 1;
    recScore = (t.strongBuy * 1 + t.buy * 0.5 + t.hold * 0 + t.sell * -0.5 + t.strongSell * -1) / total; // -1..1
    dist = { strongBuy: t.strongBuy, buy: t.buy, hold: t.hold, sell: t.sell, strongSell: t.strongSell };
  }
  const target = fin?.targetMeanPrice ?? null;
  const cur = fin?.currentPrice ?? price ?? null;
  const upside = (target && cur) ? ((target - cur) / cur) : null; // fraction

  // Composite 0..100 index: 60% analyst rating, 40% target upside (capped ±25%).
  let index = 50;
  const parts = [];
  if (recScore != null) { index = 50 + recScore * 30; parts.push({ k: 'Analyst ratings', v: Math.round((recScore + 1) * 50) }); }
  if (upside != null) {
    const u = Math.max(-0.25, Math.min(0.25, upside));
    index = (recScore != null ? index * 0.6 : 50) + (50 + (u / 0.25) * 30) * (recScore != null ? 0.4 : 1);
    parts.push({ k: 'Target upside', v: Math.round(50 + (u / 0.25) * 50) });
  }
  index = Math.max(0, Math.min(100, Math.round(index)));
  const label = index >= 70 ? 'Bullish' : index >= 58 ? 'Moderately bullish'
    : index >= 42 ? 'Neutral' : index >= 30 ? 'Moderately bearish' : 'Bearish';

  return {
    index, label, recommendationMean: fin?.recommendationMean ?? null,
    recommendationKey: fin?.recommendationKey ?? null,
    distribution: dist, numberOfAnalysts: fin?.numberOfAnalystOpinions ?? null,
    targetMean: target, targetHigh: fin?.targetHighPrice ?? null, targetLow: fin?.targetLowPrice ?? null,
    currentPrice: cur, upsidePct: upside != null ? upside * 100 : null, parts
  };
}

export default async function handler(req, res) {
  try {
    const data = await withCache('quotes:v1', 45, async () => {
      const quotes = await quoteMany(symbols).catch(() => null);
      const bySym = {};
      (quotes || []).forEach((q) => { bySym[q.symbol] = q; });

      // Finnhub fallback for the US line if Yahoo failed entirely.
      if (!quotes && finnhubEnabled()) {
        try {
          const fq = await finnhubQuote('FER');
          bySym['FER'] = {
            symbol: 'FER', currency: 'USD', regularMarketPrice: fq.price,
            regularMarketPreviousClose: fq.prevClose, regularMarketOpen: fq.open,
            regularMarketDayHigh: fq.high, regularMarketDayLow: fq.low,
            regularMarketChange: fq.change, regularMarketChangePercent: fq.changePercent
          };
        } catch { /* ignore */ }
      }

      const listings = FERROVIAL.listings.map((l) => mapQuote(l, bySym[l.symbol]));

      let sentiment = null;
      try {
        const s = await summary(FERROVIAL.primary, ['recommendationTrend', 'financialData', 'price']);
        sentiment = sentimentFrom(s.recommendationTrend, s.financialData, s.price?.regularMarketPrice);
      } catch { /* sentiment optional */ }

      return { listings, sentiment, source: quotes ? 'yahoo' : (finnhubEnabled() ? 'finnhub' : 'none') };
    });
    return ok(res, data, { cdnSeconds: 45, swr: 600 });
  } catch (err) {
    return fail(res, 502, 'Could not load quotes', { detail: String(err?.message || err) });
  }
}
