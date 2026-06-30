// Data fetcher — runs in GitHub Actions (Azure IPs, which Yahoo does NOT block).
// Pulls everything from Yahoo and writes static JSON snapshots to data/live/*.json
// that the Vercel-hosted frontend reads directly. No API keys, no Vercel→Yahoo calls.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chart, searchNews, fundamentals, computeReturns, technicals } from '../api/_lib/yahooRest.js';
import { FERROVIAL, PEERS, SHARES, PEER_MULTIPLES } from '../api/_lib/config.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'live');
mkdirSync(OUT, { recursive: true });
const now = new Date().toISOString();
const write = (file, obj) => { writeFileSync(join(OUT, file), JSON.stringify({ ...obj, generatedAt: now })); console.log('  wrote', file); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rollSMA = (a, n) => a.map((_, i) => i + 1 >= n ? a.slice(i + 1 - n, i + 1).reduce((x, y) => x + y, 0) / n : null);
const rollRSI = (c, n = 14) => c.map((_, i) => { if (i < n) return null; let g = 0, l = 0; for (let k = i - n + 1; k <= i; k++) { const d = c[k] - c[k - 1]; if (d >= 0) g += d; else l -= d; } const avgL = l / n; if (avgL === 0) return 100; return 100 - 100 / (1 + (g / n) / avgL); });
const closeAgo = (s, b) => { const i = s.length - 1 - b; return i >= 0 ? s[i].close : (s[0]?.close ?? null); };

async function listingBlock(l) {
  // One 5y daily chart powers quote + history + technicals + sentiment.
  const c = await chart(l.symbol, { range: '5y', interval: '1d', events: 'div' });
  const m = c.meta || {}, s = c.series, last = s[s.length - 1] || {};
  const price = m.regularMarketPrice ?? last.close ?? null;
  const prevClose = m.previousClose ?? m.chartPreviousClose ?? (s.length > 1 ? s[s.length - 2].close : null);
  const shares = SHARES[l.symbol];
  const quote = {
    key: l.key, symbol: l.symbol, market: l.market, currency: m.currency || l.currency, flag: l.flag, name: 'Ferrovial',
    price, prevClose, open: last.open ?? m.regularMarketOpen ?? null,
    dayHigh: m.regularMarketDayHigh ?? last.high ?? null, dayLow: m.regularMarketDayLow ?? last.low ?? null,
    volume: m.regularMarketVolume ?? last.volume ?? null,
    marketCap: (price != null && shares) ? price * shares : null,
    change: (price != null && prevClose != null) ? price - prevClose : null,
    changePercent: (price != null && prevClose) ? (price - prevClose) / prevClose * 100 : null,
    week52High: m.fiftyTwoWeekHigh ?? null, week52Low: m.fiftyTwoWeekLow ?? null,
    exchange: m.fullExchangeName || m.exchangeName || l.market, marketState: m.marketState || null
  };

  // history
  const series5y = s.map((p) => ({ t: p.date.toISOString(), c: p.close }));
  const returns = computeReturns(s.map((p) => ({ date: p.date, close: p.close })));
  const year = new Date().getUTCFullYear();
  const yStart = s.find((p) => p.date.getUTCFullYear() === year)?.close ?? s[0]?.close ?? null;
  const ytdDivs = (c.dividends || []).filter((d) => d.date.getUTCFullYear() === year);
  const ytdCash = ytdDivs.reduce((a, d) => a + (d.amount || 0), 0);
  const divRet = (yStart && ytdCash) ? ytdCash / yStart * 100 : 0;

  // intraday for the 1D view (best-effort)
  let intraday = [];
  try { const ci = await chart(l.symbol, { range: '1d', interval: '5m' }); intraday = ci.series.map((p) => ({ t: p.date.toISOString(), c: p.close })); } catch { /* */ }

  // technicals
  const closes = s.map((p) => p.close), dates = s.map((p) => p.date);
  const sma20 = rollSMA(closes, 20), sma50 = rollSMA(closes, 50), sma200 = rollSMA(closes, 200), rsi = rollRSI(closes, 14);
  const ind = technicals(closes);
  const trend = (ind.sma50 && ind.sma200) ? (ind.sma50 > ind.sma200 ? 'Uptrend (50d > 200d)' : 'Downtrend (50d < 200d)') : null;
  const rsiState = ind.rsi14 == null ? null : ind.rsi14 >= 70 ? 'Overbought' : ind.rsi14 <= 30 ? 'Oversold' : 'Neutral';
  const vsSma200 = (ind.price && ind.sma200) ? (ind.price - ind.sma200) / ind.sma200 * 100 : null;
  const techSeries = dates.map((d, i) => ({ t: d.toISOString().slice(0, 10), c: closes[i], sma20: sma20[i], sma50: sma50[i], sma200: sma200[i], rsi: rsi[i] })).slice(-300);

  return {
    quote,
    history: { symbol: l.symbol, currency: quote.currency, series5y, intraday, returns, ytd: { priceReturn: returns.ytd ?? null, dividendReturn: divRet, totalReturn: (returns.ytd ?? 0) + divRet, dividendsPaid: ytdCash }, dividends: ytdDivs.map((d) => ({ date: d.date.toISOString().slice(0, 10), amount: d.amount })) },
    technicals: { symbol: l.symbol, currency: quote.currency, indicators: { ...ind, trend, rsiState, vsSma200 }, series: techSeries },
    series: s
  };
}

function sentimentFrom(series, hi, lo) {
  if (!series || series.length < 25) return null;
  const last = series[series.length - 1].close;
  const r1m = (last / closeAgo(series, 21) - 1) * 100, r3m = (last / closeAgo(series, 63) - 1) * 100;
  const pos = (hi && lo && hi > lo) ? (last - lo) / (hi - lo) : 0.5;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let index = 50 + clamp(r3m, -20, 20) / 20 * 25 + clamp(r1m, -10, 10) / 10 * 15 + (pos - 0.5) * 20;
  index = Math.round(Math.max(0, Math.min(100, index)));
  const label = index >= 70 ? 'Bullish' : index >= 58 ? 'Moderately bullish' : index >= 42 ? 'Neutral' : index >= 30 ? 'Moderately bearish' : 'Bearish';
  return { index, label, basis: 'momentum', r1m, r3m, pos52: pos * 100 };
}

const FN = ['TotalRevenue', 'GrossProfit', 'EBITDA', 'OperatingIncome', 'NetIncome', 'DilutedEPS', 'TotalAssets', 'TotalDebt', 'CashAndCashEquivalents', 'StockholdersEquity', 'OperatingCashFlow', 'CapitalExpenditure', 'FreeCashFlow'];
const mapFin = (r) => {
  const o = { period: r.period, year: r.year, revenue: r.TotalRevenue ?? null, grossProfit: r.GrossProfit ?? null, ebitda: r.EBITDA ?? null, ebit: r.OperatingIncome ?? null, netIncome: r.NetIncome ?? null, dilutedEPS: r.DilutedEPS ?? null, totalAssets: r.TotalAssets ?? null, totalDebt: r.TotalDebt ?? null, cash: r.CashAndCashEquivalents ?? null, equity: r.StockholdersEquity ?? null, operatingCF: r.OperatingCashFlow ?? null, capex: r.CapitalExpenditure ?? null, freeCashFlow: r.FreeCashFlow ?? null };
  o.ebitdaMargin = (o.ebitda && o.revenue) ? o.ebitda / o.revenue * 100 : null;
  o.netMargin = (o.netIncome && o.revenue) ? o.netIncome / o.revenue * 100 : null;
  if (o.freeCashFlow == null && o.operatingCF != null && o.capex != null) o.freeCashFlow = o.operatingCF + o.capex;
  o.netDebt = (o.totalDebt != null && o.cash != null) ? o.totalDebt - o.cash : null;
  return o;
};

async function onePeer(p) {
  const out = { symbol: p.symbol, name: p.name, type: p.type, self: !!p.self, currency: p.currency, ...(PEER_MULTIPLES[p.symbol] || {}), indicativeMultiples: true };
  try {
    const c = await chart(p.symbol, { range: '1y', interval: '1wk' });
    out.currency = c.meta?.currency || p.currency;
    out.price = c.meta?.regularMarketPrice ?? c.series.at(-1)?.close ?? null;
    const first = c.series[0]?.close;
    out.ret1y = (out.price && first) ? (out.price - first) / first * 100 : null;
    const shares = SHARES[p.symbol];
    out.marketCap = (out.price != null && shares) ? out.price * shares : null;
  } catch { /* keep curated */ }
  // try real multiples from fundamentals
  try {
    const f = await fundamentals(p.symbol, ['NetIncome', 'EBITDA', 'TotalRevenue', 'TotalDebt', 'CashAndCashEquivalents', 'DilutedEPS'], 'annual');
    const last = f.at(-1) || {};
    if (out.price && last.DilutedEPS > 0) out.pe = out.price / last.DilutedEPS;
    if (out.marketCap && last.EBITDA > 0) { const nd = (last.TotalDebt ?? 0) - (last.CashAndCashEquivalents ?? 0); out.evEbitda = (out.marketCap + nd) / last.EBITDA; out.indicativeMultiples = false; }
    if (last.EBITDA && last.TotalRevenue) out.ebitdaMargin = last.EBITDA / last.TotalRevenue * 100;
  } catch { /* keep curated multiples */ }
  return out;
}

async function main() {
  console.log('Fetching Ferrovial data from Yahoo…');
  const blocks = {};
  for (const l of FERROVIAL.listings) {
    try { blocks[l.symbol] = await listingBlock(l); console.log('  listing', l.symbol, '→', blocks[l.symbol].quote.price); }
    catch (e) { console.log('  listing', l.symbol, 'FAILED:', e.message); }
    await sleep(500);
  }

  // quotes.json (+ sentiment from primary)
  const primary = blocks[FERROVIAL.primary];
  const sentiment = primary ? sentimentFrom(primary.series, primary.quote.week52High, primary.quote.week52Low) : null;
  write('quotes.json', { listings: FERROVIAL.listings.map((l) => blocks[l.symbol]?.quote || { key: l.key, symbol: l.symbol, market: l.market, currency: l.currency, flag: l.flag, name: 'Ferrovial', price: null }), sentiment });

  // per-listing history + technicals
  for (const l of FERROVIAL.listings) {
    if (!blocks[l.symbol]) continue;
    write(`history-${l.symbol}.json`, blocks[l.symbol].history);
    write(`technicals-${l.symbol}.json`, blocks[l.symbol].technicals);
  }

  // financials
  try {
    const [annual, quarterly] = await Promise.all([
      fundamentals(FERROVIAL.primary, FN, 'annual').then((r) => r.map(mapFin)),
      fundamentals(FERROVIAL.primary, FN, 'quarterly').then((r) => r.map(mapFin))
    ]);
    write('financials.json', { symbol: FERROVIAL.primary, currency: 'EUR', annual, quarterly });
  } catch (e) { console.log('  financials FAILED:', e.message); write('financials.json', { annual: [], quarterly: [] }); }

  // peers
  const peerRows = [];
  for (const p of PEERS) { peerRows.push(await onePeer(p)); await sleep(400); }
  write('peers.json', { rows: peerRows });

  // news
  try {
    const seen = new Set(), items = [];
    for (const q of ['Ferrovial', 'Ferrovial SE', '407 ETR']) {
      for (const n of await searchNews(q, 12)) { const k = (n.title || '').toLowerCase().slice(0, 50); if (n.title && n.url && !seen.has(k)) { seen.add(k); items.push(n); } }
      await sleep(300);
    }
    items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    write('news.json', { items: items.slice(0, 40), sources: ['Yahoo Finance'] });
  } catch (e) { console.log('  news FAILED:', e.message); write('news.json', { items: [], sources: [] }); }

  console.log('Done.');
}
main().catch((e) => { console.error(e); process.exit(1); });
