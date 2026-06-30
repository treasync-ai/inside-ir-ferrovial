// GET /api/peers → Ferrovial vs peers. Live price / market cap / 1Y performance
// from Twelve Data; valuation multiples (P/E, EV/EBITDA) from a curated baseline
// since the free data tier does not expose them.
import { PEERS, SHARES, PEER_MULTIPLES } from './_lib/config.js';
import { tdEnabled, tdQuote, tdSeries } from './_lib/twelvedata.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';

async function onePeer(p) {
  const mult = PEER_MULTIPLES[p.symbol] || {};
  let price = null, ret1y = null, changePct = null, currency = p.currency;
  if (tdEnabled()) {
    try {
      const q = await tdQuote(p.symbol);
      price = q.price; changePct = q.changePercent; currency = q.currency || currency;
    } catch { /* */ }
    try {
      const s = await tdSeries(p.symbol, { interval: '1week', outputsize: 54 });
      const first = s.series[0]?.close, last = s.series.at(-1)?.close;
      if (first && last) ret1y = (last - first) / first * 100;
      if (price == null) price = last ?? null;
    } catch { /* */ }
  }
  const shares = SHARES[p.symbol];
  return {
    symbol: p.symbol, name: p.name, type: p.type, self: !!p.self, currency,
    price, changePercent: changePct,
    marketCap: (price != null && shares) ? price * shares : null,
    ret1y,
    pe: mult.pe ?? null, evEbitda: mult.evEbitda ?? null,
    dividendYield: mult.dividendYield ?? null, ebitdaMargin: mult.ebitdaMargin ?? null,
    indicativeMultiples: true
  };
}

export default async function handler(req, res) {
  try {
    const data = await withCache('peers:v3', 60 * 60 * 3, async () => {
      const settled = await Promise.allSettled(PEERS.map(onePeer));
      const rows = settled.map((s, i) => s.status === 'fulfilled' ? s.value : { ...PEERS[i], ...(PEER_MULTIPLES[PEERS[i].symbol] || {}), indicativeMultiples: true });
      return { rows, multiplesNote: 'P/E and EV/EBITDA are curated indicative figures (~mid-2026); price, market cap and 1Y performance are live.' };
    });
    return ok(res, data, { cdnSeconds: 1800, swr: 21600 });
  } catch (err) {
    return fail(res, 502, 'Could not load peers', { detail: String(err?.message || err) });
  }
}
