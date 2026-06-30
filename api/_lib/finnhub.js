// Optional Finnhub integration (free tier). Enabled when FINNHUB_API_KEY is set
// as an environment variable in Vercel. Used as a second source for news and
// as a quote fallback if Yahoo is unavailable.
const KEY = process.env.FINNHUB_API_KEY || '';
const BASE = 'https://finnhub.io/api/v1';

export const finnhubEnabled = () => Boolean(KEY);

async function fh(path, params = {}) {
  if (!KEY) throw new Error('FINNHUB_API_KEY not configured');
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('token', KEY);
  const r = await fetch(url, { headers: { 'X-Finnhub-Token': KEY } });
  if (!r.ok) throw new Error(`Finnhub ${r.status}`);
  return r.json();
}

// Company news in a date window. symbol e.g. "FER" (US listing works best on Finnhub).
export async function finnhubNews(symbol = 'FER', days = 21) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const items = await fh('/company-news', { symbol, from: iso(from), to: iso(to) });
  return (items || []).map((n) => ({
    title: n.headline,
    url: n.url,
    source: n.source,
    summary: n.summary,
    image: n.image || null,
    publishedAt: n.datetime ? new Date(n.datetime * 1000).toISOString() : null,
    provider: 'Finnhub'
  }));
}

export async function finnhubQuote(symbol = 'FER') {
  const q = await fh('/quote', { symbol });
  return {
    price: q.c, open: q.o, high: q.h, low: q.l, prevClose: q.pc,
    change: q.d, changePercent: q.dp, provider: 'Finnhub'
  };
}
