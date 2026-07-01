// Data client. Live market data is pre-fetched by a GitHub Action (Yahoo works
// from Azure runners) and committed as static JSON under /data/live, which Vercel
// serves from its CDN. No serverless functions, no API keys.
const memo = new Map();

function setStatus(generatedAt) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (!dot || !txt) return;
  if (!generatedAt) { dot.className = 'dot stale'; txt.textContent = 'awaiting first refresh'; return; }
  const ageMin = (Date.now() - new Date(generatedAt)) / 60000;
  dot.className = ageMin < 90 ? 'dot' : 'dot stale';
  const t = new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  txt.textContent = `data as of ${t}`;
}

// Live snapshots are committed to GitHub by the scheduled Action. We read them
// straight from GitHub's raw CDN (CORS-enabled, refreshes on every commit) so the
// data updates WITHOUT any Vercel redeploy. Falls back to the copy bundled with
// the deployment if raw is unreachable.
const RAW = 'https://raw.githubusercontent.com/treasync-ai/inside-ir-ferrovial/main/data/live/';

async function live(file) {
  const key = 'live:' + file;
  const cached = memo.get(key);
  if (cached && cached.until > Date.now()) return cached.promise;
  const bust = Math.floor(Date.now() / 60000); // refresh at most once a minute
  const promise = (async () => {
    try {
      const r = await fetch(`${RAW}${file}?t=${bust}`, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch { /* fall back to bundled copy */ }
    const r2 = await fetch(`/data/live/${file}?t=${bust}`);
    if (!r2.ok) throw new Error(`${file} not ready (${r2.status})`);
    return r2.json();
  })().then((j) => { if (j.generatedAt) setStatus(j.generatedAt); return j; });
  memo.set(key, { promise, until: Date.now() + 30000 });
  promise.catch(() => memo.delete(key));
  return promise;
}

function sliceRange(series5y, range, intraday) {
  if (range === '1d') return (intraday && intraday.length) ? intraday : series5y.slice(-2);
  const year = new Date().getUTCFullYear();
  const days = { '1w': 7, '1m': 31, '3m': 92, '6m': 183, '1y': 366, '5y': 999999 }[range] ?? 366;
  const cutoff = range === 'ytd' ? Date.UTC(year, 0, 1) : Date.now() - days * 86400000;
  return series5y.filter((p) => new Date(p.t).getTime() >= cutoff);
}

// Keeps the old api(name, params) interface; routes to static files.
export async function api(name, params = {}) {
  switch (name) {
    case 'quotes': return live('quotes.json');
    case 'peers': return live('peers.json');
    case 'analysts': return live('analysts.json');
    case 'dividends': return live('dividends.json');
    case 'tsr': return live('tsr.json');
    case 'news': return live('news.json');
    case 'calendar': return { events: [] };
    case 'financials': {
      const d = await live('financials.json');
      return { symbol: d.symbol, currency: d.currency || 'EUR', freq: params.freq || 'annual', rows: d[params.freq || 'annual'] || [] };
    }
    case 'technicals': return live(`technicals-${params.symbol || 'FER.MC'}.json`);
    case 'history': {
      const d = await live(`history-${params.symbol || 'FER.MC'}.json`);
      return { symbol: d.symbol, currency: d.currency, series: sliceRange(d.series5y || [], params.range || '1y', d.intraday), returns: d.returns, ytd: d.ytd, dividends: d.dividends };
    }
    default: throw new Error('unknown feed ' + name);
  }
}

// Curated static JSON from /data
export async function data(file) {
  const key = 'data:' + file;
  if (memo.has(key)) return memo.get(key).promise;
  const promise = fetch(`/data/${file}`).then((r) => { if (!r.ok) throw new Error('data ' + r.status); return r.json(); });
  memo.set(key, { promise, until: Infinity });
  return promise;
}

export { setStatus };
