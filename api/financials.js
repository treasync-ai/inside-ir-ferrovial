// GET /api/financials?freq=annual|quarterly → multi-year IFRS lines from Yahoo's
// crumbless fundamentals time-series. The frontend overlays curated KPIs.
import { fundamentals } from './_lib/yahooRest.js';
import { withCache } from './_lib/cache.js';
import { ok, fail, qp } from './_lib/http.js';
import { FERROVIAL } from './_lib/config.js';

const NAMES = ['TotalRevenue', 'GrossProfit', 'EBITDA', 'OperatingIncome', 'NetIncome', 'DilutedEPS',
  'TotalAssets', 'TotalDebt', 'CashAndCashEquivalents', 'StockholdersEquity',
  'OperatingCashFlow', 'CapitalExpenditure', 'FreeCashFlow'];

const map = (r) => {
  const o = {
    period: r.period, year: r.year,
    revenue: r.TotalRevenue ?? null, grossProfit: r.GrossProfit ?? null, ebitda: r.EBITDA ?? null,
    ebit: r.OperatingIncome ?? null, netIncome: r.NetIncome ?? null, dilutedEPS: r.DilutedEPS ?? null,
    totalAssets: r.TotalAssets ?? null, totalDebt: r.TotalDebt ?? null, cash: r.CashAndCashEquivalents ?? null,
    equity: r.StockholdersEquity ?? null, operatingCF: r.OperatingCashFlow ?? null,
    capex: r.CapitalExpenditure ?? null, freeCashFlow: r.FreeCashFlow ?? null
  };
  o.ebitdaMargin = (o.ebitda && o.revenue) ? (o.ebitda / o.revenue) * 100 : null;
  o.netMargin = (o.netIncome && o.revenue) ? (o.netIncome / o.revenue) * 100 : null;
  if (o.freeCashFlow == null && o.operatingCF != null && o.capex != null) o.freeCashFlow = o.operatingCF + o.capex;
  o.netDebt = (o.totalDebt != null && o.cash != null) ? o.totalDebt - o.cash : null;
  return o;
};

export default async function handler(req, res) {
  const freq = qp(req, 'freq', 'annual') === 'quarterly' ? 'quarterly' : 'annual';
  try {
    const data = await withCache(`fin:${freq}`, 60 * 60 * 12, async () => {
      const rows = await fundamentals(FERROVIAL.primary, NAMES, freq);
      return { symbol: FERROVIAL.primary, currency: 'EUR', freq, rows: rows.map(map) };
    });
    return ok(res, data, { cdnSeconds: 3600, swr: 86400 });
  } catch (err) {
    return fail(res, 502, 'Could not load financials', { detail: String(err?.message || err) });
  }
}
