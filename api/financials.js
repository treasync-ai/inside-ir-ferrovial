// GET /api/financials?freq=annual|quarterly
// Multi-year income / balance / cash-flow lines from Yahoo's fundamentals
// time-series. The frontend overlays a curated baseline (FY2023-2025) so the
// page always shows solid core figures even when Yahoo coverage is thin.
import { fundamentals } from './_lib/yahoo.js';
import { withCache } from './_lib/cache.js';
import { ok, fail, qp } from './_lib/http.js';
import { FERROVIAL } from './_lib/config.js';

const SYMBOL = FERROVIAL.primary; // FER.MC has the deepest fundamentals history.

// Map of output field -> candidate Yahoo keys (prefixed and bare forms).
const FIELDS = {
  revenue:        ['totalRevenue', 'TotalRevenue', 'operatingRevenue'],
  grossProfit:    ['grossProfit', 'GrossProfit'],
  ebitda:         ['EBITDA', 'normalizedEBITDA', 'ebitda'],
  ebit:           ['EBIT', 'ebit', 'operatingIncome', 'OperatingIncome'],
  netIncome:      ['netIncome', 'NetIncome', 'netIncomeCommonStockholders'],
  dilutedEPS:     ['dilutedEPS', 'DilutedEPS', 'basicEPS'],
  interestExpense:['interestExpense', 'InterestExpense', 'netInterestIncome'],
  totalAssets:    ['totalAssets', 'TotalAssets'],
  totalDebt:      ['totalDebt', 'TotalDebt'],
  cash:           ['cashAndCashEquivalents', 'CashAndCashEquivalents', 'cashCashEquivalentsAndShortTermInvestments'],
  equity:         ['stockholdersEquity', 'StockholdersEquity', 'totalEquityGrossMinorityInterest', 'commonStockEquity'],
  operatingCF:    ['operatingCashFlow', 'OperatingCashFlow', 'cashFlowFromContinuingOperatingActivities'],
  capex:          ['capitalExpenditure', 'CapitalExpenditure'],
  freeCashFlow:   ['freeCashFlow', 'FreeCashFlow']
};

const pick = (row, names) => {
  for (const n of names) {
    for (const key of [n, 'annual' + cap(n), 'quarterly' + cap(n)]) {
      const v = row[key];
      if (v != null) return typeof v === 'object' ? (v.raw ?? null) : v;
    }
  }
  return null;
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

async function fetchSeries(type) {
  const opts = { period1: '2017-01-01', type, module: 'all' };
  let rows;
  try { rows = await fundamentals(SYMBOL, opts); }
  catch { rows = await fundamentals(SYMBOL, { ...opts, module: 'financials' }).catch(() => []); }

  return (rows || []).map((r) => {
    const date = new Date(r.date);
    const out = { period: date.toISOString().slice(0, 10), year: date.getUTCFullYear() };
    for (const [field, names] of Object.entries(FIELDS)) out[field] = pick(r, names);
    // derive margins
    out.ebitdaMargin = out.ebitda && out.revenue ? (out.ebitda / out.revenue) * 100 : null;
    out.netMargin    = out.netIncome && out.revenue ? (out.netIncome / out.revenue) * 100 : null;
    if (out.freeCashFlow == null && out.operatingCF != null && out.capex != null)
      out.freeCashFlow = out.operatingCF + out.capex; // capex is negative in Yahoo data
    out.netDebt = (out.totalDebt != null && out.cash != null) ? out.totalDebt - out.cash : null;
    return out;
  }).sort((a, b) => a.year - b.year);
}

export default async function handler(req, res) {
  const freq = qp(req, 'freq', 'annual') === 'quarterly' ? 'quarterly' : 'annual';
  try {
    const data = await withCache(`fin:${freq}`, 60 * 60 * 12, async () => {
      const rows = await fetchSeries(freq);
      return { symbol: SYMBOL, currency: 'EUR', freq, rows };
    });
    return ok(res, data, { cdnSeconds: 3600, swr: 86400 });
  } catch (err) {
    return fail(res, 502, 'Could not load financials', { detail: String(err?.message || err) });
  }
}
