// GET /api/news → merged Ferrovial news from Yahoo (crumbless search) + Finnhub.
import { searchNews } from './_lib/yahooRest.js';
import { finnhubEnabled, finnhubNews } from './_lib/finnhub.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function yahooAll() {
  const out = [];
  for (const q of ['Ferrovial', 'Ferrovial SE', '407 ETR']) {
    try { (await searchNews(q, 12)).forEach((n) => out.push(n)); } catch { /* keep going */ }
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const data = await withCache('news:v2', 60 * 60, async () => {
      const [yh, fh] = await Promise.all([
        yahooAll(),
        finnhubEnabled() ? finnhubNews('FER', 30).catch(() => []) : Promise.resolve([])
      ]);
      const seen = new Set();
      const merged = [...fh, ...yh].filter((n) => {
        if (!n.title || !n.url) return false;
        const k = norm(n.title).slice(0, 60);
        if (seen.has(k)) return false; seen.add(k); return true;
      }).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      return { items: merged.slice(0, 40), sources: ['Yahoo Finance', ...(finnhubEnabled() ? ['Finnhub'] : [])] };
    });
    return ok(res, data, { cdnSeconds: 1800, swr: 7200 });
  } catch (err) {
    return fail(res, 502, 'Could not load news', { detail: String(err?.message || err) });
  }
}
