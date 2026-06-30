// Direct Yahoo Finance REST client (no yahoo-finance2 library).
// Uses ONLY the crumbless endpoints that work from datacenter / serverless IPs:
//   - /v8/finance/chart         (prices, history, technicals, quote meta)
//   - /v1/finance/search        (news)
//   - /ws/fundamentals-timeseries (multi-year financials)
// The quoteSummary / quote v7 endpoints require a crumb (401 on Vercel) and are avoided.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const host = HOSTS[i % HOSTS.length];
    try {
      const res = await fetch(host + path, {
        headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' }
      });
      if (res.status === 429 || res.status === 401 || res.status >= 500) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      return body;
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(400 * (i + 1) + Math.random() * 200);
    }
  }
  throw lastErr;
}

// ---- chart ----------------------------------------------------------------
export async function chart(symbol, { range = '1y', interval = '1d', events = '' } = {}) {
  const ev = events ? `&events=${events}` : '';
  const body = await fetchJson(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false${ev}`);
  const r = body?.chart?.result?.[0];
  if (!r) throw new Error('No chart data for ' + symbol);
  const meta = r.meta || {};
  const ts = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const series = ts.map((t, i) => ({
    date: new Date(t * 1000),
    open: q.open?.[i] ?? null, high: q.high?.[i] ?? null, low: q.low?.[i] ?? null,
    close: q.close?.[i] ?? null, volume: q.volume?.[i] ?? null
  })).filter((p) => p.close != null);
  const divObj = r.events?.dividends || {};
  const dividends = Object.values(divObj).map((d) => ({ date: new Date(d.date * 1000), amount: d.amount }))
    .filter((d) => !isNaN(d.date));
  return { meta, series, dividends };
}

// Quote derived from a recent chart (crumbless). Market cap is computed by the
// caller from shares outstanding (chart meta does not include it).
export async function quoteFromChart(symbol) {
  const { meta, series } = await chart(symbol, { range: '5d', interval: '1d' });
  const last = series[series.length - 1] || {};
  const price = meta.regularMarketPrice ?? last.close ?? null;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ??
    (series.length > 1 ? series[series.length - 2].close : null);
  const change = (price != null && prevClose != null) ? price - prevClose : null;
  return {
    symbol, currency: meta.currency || null,
    price, prevClose,
    open: last.open ?? meta.regularMarketOpen ?? null,
    dayHigh: meta.regularMarketDayHigh ?? last.high ?? null,
    dayLow: meta.regularMarketDayLow ?? last.low ?? null,
    volume: meta.regularMarketVolume ?? last.volume ?? null,
    week52High: meta.fiftyTwoWeekHigh ?? null,
    week52Low: meta.fiftyTwoWeekLow ?? null,
    change, changePercent: (change != null && prevClose) ? (change / prevClose) * 100 : null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    marketState: meta.marketState || null
  };
}

// ---- search / news --------------------------------------------------------
export async function searchNews(query, count = 10) {
  const body = await fetchJson(`/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`);
  return (body?.news || []).map((n) => ({
    title: n.title, url: n.link, source: n.publisher,
    publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
    image: n.thumbnail?.resolutions?.[0]?.url || null, provider: 'Yahoo Finance'
  }));
}

// ---- fundamentals time-series --------------------------------------------
// types: array of canonical names WITHOUT prefix, e.g. ['TotalRevenue','NetIncome'].
// freq: 'annual' | 'quarterly'. Returns rows: [{period, year, <name>:value,...}] asc by date.
export async function fundamentals(symbol, names, freq = 'annual') {
  const prefix = freq === 'quarterly' ? 'quarterly' : 'annual';
  const types = names.map((n) => prefix + n).join(',');
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const period1 = Math.floor(Date.now() / 1000) - 9 * 365 * 86400;
  const body = await fetchJson(
    `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=${types}&period1=${period1}&period2=${period2}`
  );
  const results = body?.timeseries?.result || [];
  const byPeriod = {};
  for (const r of results) {
    const typeName = r.meta?.type?.[0]; if (!typeName) continue;
    const bare = typeName.replace(/^annual|^quarterly/, '');
    const arr = r[typeName]; if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (!entry || entry.reportedValue == null) continue;
      const date = entry.asOfDate; if (!date) continue;
      (byPeriod[date] ||= { period: date, year: Number(date.slice(0, 4)) })[bare] = entry.reportedValue.raw;
    }
  }
  return Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period));
}

// ---- derived helpers ------------------------------------------------------
function closeOnOrBefore(series, target) {
  let pick = null;
  for (const p of series) { if (p.date <= target && p.close != null) pick = p; else if (p.date > target) break; }
  return pick?.close ?? null;
}

export function computeReturns(series) {
  const clean = series.filter((p) => p.close != null).sort((a, b) => a.date - b.date);
  if (!clean.length) return {};
  const last = clean[clean.length - 1], now = last.date, day = 86400000;
  const at = (d) => closeOnOrBefore(clean, d);
  const pct = (from) => (from != null && from !== 0) ? ((last.close - from) / from) * 100 : null;
  const prev = clean.length > 1 ? clean[clean.length - 2].close : null;
  return {
    last: last.close, asOf: now.toISOString(),
    '1d': pct(prev), '1w': pct(at(new Date(now - 7 * day))), '1m': pct(at(new Date(now - 30 * day))),
    '3m': pct(at(new Date(now - 91 * day))), '6m': pct(at(new Date(now - 182 * day))),
    'ytd': pct(at(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)))),
    '1y': pct(at(new Date(now - 365 * day))), '5y': pct(clean[0].close)
  };
}

export function technicals(closes) {
  const sma = (n) => closes.length >= n ? closes.slice(-n).reduce((a, b) => a + b, 0) / n : null;
  const ema = (n) => {
    if (closes.length < n) return null;
    const k = 2 / (n + 1); let e = closes.slice(0, n).reduce((a, b) => a + b, 0) / n;
    for (let i = n; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
    return e;
  };
  const rsi = (n = 14) => {
    if (closes.length < n + 1) return null;
    let g = 0, l = 0;
    for (let i = closes.length - n; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) g += d; else l -= d; }
    const avgL = l / n; if (avgL === 0) return 100;
    return 100 - 100 / (1 + (g / n) / avgL);
  };
  return { price: closes[closes.length - 1] ?? null, sma20: sma(20), sma50: sma(50), sma200: sma(200), ema20: ema(20), ema50: ema(50), rsi14: rsi(14) };
}
