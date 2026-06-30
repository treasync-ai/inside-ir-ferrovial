// Thin wrapper around yahoo-finance2 with notice suppression, retry/backoff
// and a few derived helpers (returns over standard windows, technicals).
import yahooFinance from 'yahoo-finance2';

try { yahooFinance.suppressNotices(['yahooSurvey', 'ripHistorical']); } catch { /* older/newer versions */ }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry transient failures (notably Yahoo's "Too Many Requests" 429).
async function retry(fn, { tries = 3, base = 600 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const transient = msg.includes('Too Many Requests') || msg.includes('429') ||
                        msg.includes('fetch failed') || msg.includes('ETIMEDOUT') || msg.includes('socket');
      if (!transient || i === tries - 1) break;
      await sleep(base * Math.pow(2, i) + Math.random() * 250);
    }
  }
  throw lastErr;
}

export const yf = yahooFinance;

export const quote      = (sym)        => retry(() => yahooFinance.quote(sym));
export const quoteMany  = (syms)       => retry(() => yahooFinance.quote(syms));
export const summary    = (sym, mods)  => retry(() => yahooFinance.quoteSummary(sym, { modules: mods }));
export const search     = (q, opts)    => retry(() => yahooFinance.search(q, opts));
export const fundamentals = (sym, opts)=> retry(() => yahooFinance.fundamentalsTimeSeries(sym, opts));

export async function chart(sym, { period1, period2, interval = '1d', events } = {}) {
  return retry(() => yahooFinance.chart(sym, {
    period1: period1 ?? '2019-01-01',
    period2,
    interval,
    events
  }));
}

// ---- derived helpers -------------------------------------------------------

// Given an ascending [{date, close}] series, find the close on-or-before `target`.
function closeOnOrBefore(series, target) {
  let pick = null;
  for (const p of series) {
    if (p.date <= target && p.close != null) pick = p;
    else if (p.date > target) break;
  }
  return pick?.close ?? null;
}

// Compute % returns over the standard IR windows from a daily series.
export function computeReturns(series) {
  const clean = series.filter((p) => p.close != null).sort((a, b) => a.date - b.date);
  if (!clean.length) return {};
  const last = clean[clean.length - 1];
  const now = last.date;
  const day = 86400000;
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const at = (d) => closeOnOrBefore(clean, d);
  const pct = (from) => (from != null && from !== 0) ? ((last.close - from) / from) * 100 : null;

  const prevClose = clean.length > 1 ? clean[clean.length - 2].close : null;

  return {
    last: last.close,
    asOf: now.toISOString(),
    '1d':  pct(prevClose),
    '1w':  pct(at(new Date(now - 7 * day))),
    '1m':  pct(at(new Date(now - 30 * day))),
    '3m':  pct(at(new Date(now - 91 * day))),
    '6m':  pct(at(new Date(now - 182 * day))),
    'ytd': pct(at(startOfYear)),
    '1y':  pct(at(new Date(now - 365 * day))),
    '5y':  pct(clean[0].close)
  };
}

// RSI(14) and simple/exponential moving averages from closes.
export function technicals(closes) {
  const sma = (n) => closes.length >= n
    ? closes.slice(-n).reduce((a, b) => a + b, 0) / n : null;

  const ema = (n) => {
    if (closes.length < n) return null;
    const k = 2 / (n + 1);
    let e = closes.slice(0, n).reduce((a, b) => a + b, 0) / n;
    for (let i = n; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
    return e;
  };

  const rsi = (n = 14) => {
    if (closes.length < n + 1) return null;
    let gain = 0, loss = 0;
    for (let i = closes.length - n; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      if (d >= 0) gain += d; else loss -= d;
    }
    const avgG = gain / n, avgL = loss / n;
    if (avgL === 0) return 100;
    const rs = avgG / avgL;
    return 100 - 100 / (1 + rs);
  };

  return {
    price: closes[closes.length - 1] ?? null,
    sma20: sma(20), sma50: sma(50), sma200: sma(200),
    ema20: ema(20), ema50: ema(50),
    rsi14: rsi(14)
  };
}
