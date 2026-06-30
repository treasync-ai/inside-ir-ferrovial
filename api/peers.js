// GET /api/peers → Ferrovial vs peers on valuation multiples, built from the
// crumbless chart + fundamentals endpoints (P/E from price ÷ EPS; market cap
// from price × shares; EV/EBITDA from market cap + net debt ÷ EBITDA).
import { PEERS, SHARES } from './_lib/config.js';
import { chart, fundamentals } from './_lib/yahooRest.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';

const FN = ['TotalRevenue', 'NetIncome', 'EBITDA', 'DilutedEPS', 'TotalDebt', 'CashAndCashEquivalents'];

async function onePeer(p) {
  const [c, f] = await Promise.all([
    chart(p.symbol, { range: '1y', interval: '1mo' }),
    fundamentals(p.symbol, FN, 'annual').catch(() => [])
  ]);
  const price = c.meta?.regularMarketPrice ?? c.series.at(-1)?.close ?? null;
  const first = c.series[0]?.close ?? null;
  const ret1y = (price && first) ? (price - first) / first * 100 : null;
  const last = f.at(-1) || {}, prev = f.at(-2) || {};
  const shares = SHARES[p.symbol];
  const marketCap = (price != null && shares) ? price * shares : null;
  const eps = last.DilutedEPS ?? null;
  const ebitda = last.EBITDA ?? null;
  const netDebt = (last.TotalDebt != null && last.CashAndCashEquivalents != null) ? last.TotalDebt - last.CashAndCashEquivalents : null;
  const ev = (marketCap != null && netDebt != null) ? marketCap + netDebt : marketCap;
  return {
    symbol: p.symbol, name: p.name, type: p.type, self: !!p.self, currency: c.meta?.currency || p.currency,
    price, marketCap,
    pe: (price && eps && eps > 0) ? price / eps : null,
    evEbitda: (ev != null && ebitda && ebitda > 0) ? ev / ebitda : null,
    ebitdaMargin: (ebitda && last.TotalRevenue) ? ebitda / last.TotalRevenue * 100 : null,
    netMargin: (last.NetIncome && last.TotalRevenue) ? last.NetIncome / last.TotalRevenue * 100 : null,
    revenueGrowth: (last.TotalRevenue && prev.TotalRevenue) ? (last.TotalRevenue - prev.TotalRevenue) / prev.TotalRevenue * 100 : null,
    ret1y
  };
}

export default async function handler(req, res) {
  try {
    const data = await withCache('peers:v2', 60 * 60 * 6, async () => {
      const settled = await Promise.allSettled(PEERS.map(onePeer));
      const rows = settled.map((s, i) => s.status === 'fulfilled' ? s.value
        : { symbol: PEERS[i].symbol, name: PEERS[i].name, type: PEERS[i].type, self: !!PEERS[i].self, currency: PEERS[i].currency });
      return { rows };
    });
    return ok(res, data, { cdnSeconds: 3600, swr: 21600 });
  } catch (err) {
    return fail(res, 502, 'Could not load peers', { detail: String(err?.message || err) });
  }
}
