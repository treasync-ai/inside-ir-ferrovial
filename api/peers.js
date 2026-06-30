// GET /api/peers → Ferrovial vs its peer set on valuation multiples.
import { PEERS } from './_lib/config.js';
import { quoteMany, summary } from './_lib/yahoo.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';

const symbols = PEERS.map((p) => p.symbol);

export default async function handler(req, res) {
  try {
    const data = await withCache('peers:v1', 60 * 60 * 6, async () => {
      const quotes = await quoteMany(symbols).catch(() => []);
      const bySym = {}; (quotes || []).forEach((q) => { bySym[q.symbol] = q; });

      // Enrich with EV/EBITDA via quoteSummary (best-effort, in parallel).
      const ev = {};
      await Promise.allSettled(symbols.map(async (s) => {
        try {
          const qs = await summary(s, ['defaultKeyStatistics', 'financialData']);
          ev[s] = {
            evEbitda: qs.defaultKeyStatistics?.enterpriseToEbitda ?? null,
            evRevenue: qs.defaultKeyStatistics?.enterpriseToRevenue ?? null,
            ebitdaMargin: qs.financialData?.ebitdaMargins != null ? qs.financialData.ebitdaMargins * 100 : null,
            roe: qs.financialData?.returnOnEquity != null ? qs.financialData.returnOnEquity * 100 : null,
            revenueGrowth: qs.financialData?.revenueGrowth != null ? qs.financialData.revenueGrowth * 100 : null
          };
        } catch { ev[s] = {}; }
      }));

      const rows = PEERS.map((p) => {
        const q = bySym[p.symbol] || {};
        const e = ev[p.symbol] || {};
        return {
          symbol: p.symbol, name: p.name, type: p.type, self: !!p.self,
          currency: q.currency || p.currency,
          price: q.regularMarketPrice ?? null,
          marketCap: q.marketCap ?? null,
          pe: q.trailingPE ?? null,
          forwardPE: q.forwardPE ?? null,
          priceToBook: q.priceToBook ?? null,
          dividendYield: q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100
                        : (q.dividendYield ?? null),
          evEbitda: e.evEbitda ?? null,
          evRevenue: e.evRevenue ?? null,
          ebitdaMargin: e.ebitdaMargin ?? null,
          roe: e.roe ?? null,
          revenueGrowth: e.revenueGrowth ?? null,
          ret1y: q.fiftyTwoWeekChangePercent != null ? q.fiftyTwoWeekChangePercent : null
        };
      });
      return { rows };
    });
    return ok(res, data, { cdnSeconds: 3600, swr: 21600 });
  } catch (err) {
    return fail(res, 502, 'Could not load peers', { detail: String(err?.message || err) });
  }
}
