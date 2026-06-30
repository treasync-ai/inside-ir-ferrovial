// Lightweight API + static-data client with in-flight de-dup and a tiny cache.
const memo = new Map();

function setStatus(state) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (!dot || !txt) return;
  if (state === 'live') { dot.className = 'dot'; txt.textContent = 'live data'; }
  else if (state === 'partial') { dot.className = 'dot'; txt.textContent = 'live + curated'; }
  else { dot.className = 'dot stale'; txt.textContent = 'curated (offline)'; }
}

// Call a serverless endpoint: /api/<name>?params
export async function api(name, params = {}, { ttl = 30000 } = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `/api/${name}${qs ? '?' + qs : ''}`;
  const key = 'api:' + url;
  const cached = memo.get(key);
  if (cached && cached.until > Date.now()) return cached.promise;

  const promise = fetch(url, { headers: { accept: 'application/json' } })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok || body.ok === false) throw new Error(body.error || `HTTP ${r.status}`);
      return body.data ?? body;
    });
  memo.set(key, { promise, until: Date.now() + ttl });
  promise.catch(() => memo.delete(key)); // don't cache failures
  return promise;
}

// Load a curated JSON file from /data
export async function data(file) {
  const key = 'data:' + file;
  if (memo.has(key)) return memo.get(key).promise;
  const promise = fetch(`/data/${file}`).then((r) => { if (!r.ok) throw new Error('data ' + r.status); return r.json(); });
  memo.set(key, { promise, until: Infinity });
  return promise;
}

export { setStatus };
