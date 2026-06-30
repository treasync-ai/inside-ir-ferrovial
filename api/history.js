// GET /api/history?symbol=FER.MC&range=1y
// Provider: Twelve Data → Yahoo REST. Returns price series for the range +
// % returns for every window. (Dividend data needs a paid feed; YTD dividend
// return is shown as 0 unless available.)
import { tdEnabled, tdSeries } from './_lib/twelvedata.js';
import { chart } from './_lib/yahooRest.js';
import { computeReturns } from './_lib/yahooRest.js';
import { withCache } from './_lib/cache.js';
import { ok, fail, qp } from './_lib/http.js';
import { FERROVIAL } from './_lib/config.js';

const VALID = new Set(['FER', 'FER.MC', 'FER.AS']);
const RANGE_DAYS = { '1w': 7, '1m': 31, '3m': 92, '6m': 183, '1y': 366, '5y': 1830 };

async function base5y(symbol) {
  if (tdEnabled()) {
    try {
      const r = await tdSeries(symbol, { interval: '1day', outputsize: 1400 });
      return { series: r.series.map((p) => ({ date: p.date, close: p.close })), currency: r.currency, divs: [] };
    } catch { /* fall back */ }
  }
  const c = await chart(symbol, { range: '5y', interval: '1d', events: 'div' });
  return { series: c.series.map((p) => ({ date: p.date, close: p.close })), currency: c.meta?.currency, divs: c.dividends || [] };
}

async function intraday(symbol) {
  if (tdEnabled()) {
    try { const r = await tdSeries(symbol, { interval: '5min', outputsize: 100 }); return r.series.map((p) => ({ t: p.date.toISOString(), c: p.close })); }
    catch { /* */ }
  }
  const c = await chart(symbol, { range: '1d', interval: '5m' });
  return c.series.map((p) => ({ t: p.date.toISOString(), c: p.close }));
}

export default async function handler(req, res) {
  const symbol = VALID.has(qp(req, 'symbol')) ? qp(req, 'symbol') : FERROVIAL.primary;
  const range = qp(req, 'range', '1y');
  try {
    const baseData = await withCache(`hist5y:${symbol}`, 60 * 30, () => base5y(symbol));
    const returns = computeReturns(baseData.series);
    const year = new Date().getUTCFullYear();
    const yStart = baseData.series.find((p) => p.date.getUTCFullYear() === year)?.close ?? baseData.series[0]?.close ?? null;
    const ytdDivs = (baseData.divs || []).filter((d) => d.date.getUTCFullYear() === year);
    const ytdDivCash = ytdDivs.reduce((a, d) => a + (d.amount || 0), 0);
    const dividendReturnYtd = (yStart && ytdDivCash) ? (ytdDivCash / yStart) * 100 : 0;

    let series;
    if (range === '1d') series = await withCache(`hist1d:${symbol}`, 180, () => intraday(symbol));
    else {
      const cutoff = range === 'ytd' ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.now() - (RANGE_DAYS[range] ?? 366) * 86400000);
      series = baseData.series.filter((p) => p.date >= cutoff).map((p) => ({ t: p.date.toISOString(), c: p.close }));
    }

    return ok(res, {
      symbol, range, currency: baseData.currency, series, returns,
      ytd: { priceReturn: returns.ytd ?? null, dividendReturn: dividendReturnYtd, totalReturn: (returns.ytd ?? 0) + dividendReturnYtd, dividendsPaid: ytdDivCash },
      dividends: ytdDivs.map((d) => ({ date: d.date.toISOString().slice(0, 10), amount: d.amount }))
    }, { cdnSeconds: 300, swr: 1800 });
  } catch (err) {
    return fail(res, 502, 'Could not load history', { detail: String(err?.message || err) });
  }
}
