// GET /api/history?symbol=FER.MC&range=1y
// Returns a price series for the requested range + % returns for all windows
// + dividends in the current year (for the YTD dividend-return figure).
import { chart, computeReturns } from './_lib/yahoo.js';
import { withCache } from './_lib/cache.js';
import { ok, fail, qp } from './_lib/http.js';
import { FERROVIAL } from './_lib/config.js';

const VALID = new Set(['FER', 'FER.MC', 'FER.AS']);
const RANGE_DAYS = { '1w': 7, '1m': 31, '3m': 92, '6m': 183, 'ytd': null, '1y': 366, '5y': 1830 };

export default async function handler(req, res) {
  const symbol = VALID.has(qp(req, 'symbol')) ? qp(req, 'symbol') : FERROVIAL.primary;
  const range = qp(req, 'range', '1y');

  try {
    // One cached 5y daily pull per symbol powers returns + every non-intraday chart.
    const base = await withCache(`hist5y:${symbol}`, 60 * 30, async () => {
      const c = await chart(symbol, { period1: '2019-01-01', interval: '1d', events: 'dividends' });
      const series = (c.quotes || [])
        .filter((q) => q.close != null)
        .map((q) => ({ date: new Date(q.date), close: q.close, volume: q.volume ?? null }));
      const divs = (c.events?.dividends ? Object.values(c.events.dividends) : (c.dividends || []))
        .map((d) => ({ date: new Date((d.date ?? d) * (String(d.date ?? d).length > 11 ? 1 : 1000)), amount: d.amount ?? null }))
        .filter((d) => !isNaN(d.date));
      return { series, divs, meta: { currency: c.meta?.currency, symbol } };
    });

    const returns = computeReturns(base.series);

    // YTD dividend return = dividends paid this calendar year / year-start price.
    const year = new Date().getUTCFullYear();
    const yStart = base.series.find((p) => p.date.getUTCFullYear() === year)?.close
                 ?? base.series[0]?.close ?? null;
    const ytdDivs = (base.divs || []).filter((d) => d.date.getUTCFullYear() === year);
    const ytdDivCash = ytdDivs.reduce((a, d) => a + (d.amount || 0), 0);
    const dividendReturnYtd = (yStart && ytdDivCash) ? (ytdDivCash / yStart) * 100 : 0;

    // Build the chart series for the requested range.
    let series;
    if (range === '1d') {
      const intraday = await withCache(`hist1d:${symbol}`, 120, async () => {
        const c = await chart(symbol, { period1: new Date(Date.now() - 5 * 86400000), interval: '5m' });
        return (c.quotes || []).filter((q) => q.close != null).map((q) => ({ t: new Date(q.date).toISOString(), c: q.close }));
      });
      // keep only the last available session
      const lastDay = intraday.length ? intraday[intraday.length - 1].t.slice(0, 10) : null;
      series = intraday.filter((p) => p.t.slice(0, 10) === lastDay);
    } else {
      const days = RANGE_DAYS[range] ?? 366;
      const cutoff = range === 'ytd' ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.now() - (days) * 86400000);
      series = base.series.filter((p) => p.date >= cutoff).map((p) => ({ t: p.date.toISOString(), c: p.close }));
    }

    return ok(res, {
      symbol, range, currency: base.meta.currency,
      series, returns,
      ytd: { priceReturn: returns.ytd ?? null, dividendReturn: dividendReturnYtd, totalReturn: (returns.ytd ?? 0) + dividendReturnYtd, dividendsPaid: ytdDivCash },
      dividends: ytdDivs.map((d) => ({ date: d.date.toISOString().slice(0, 10), amount: d.amount }))
    }, { cdnSeconds: 120, swr: 1800 });
  } catch (err) {
    return fail(res, 502, 'Could not load history', { detail: String(err?.message || err) });
  }
}
