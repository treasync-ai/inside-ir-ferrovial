// Tiny in-memory TTL cache. Warm Vercel instances reuse this between requests,
// which keeps us comfortably under Yahoo's rate limits.
const store = new Map();

export async function withCache(key, ttlSeconds, producer) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  // Serve stale on producer error if we have anything cached.
  try {
    const value = await producer();
    store.set(key, { value, expires: now + ttlSeconds * 1000 });
    return value;
  } catch (err) {
    if (hit) return hit.value; // stale-on-error
    throw err;
  }
}

export function getStale(key) {
  return store.get(key)?.value ?? null;
}
