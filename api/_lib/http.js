// Shared response helpers for the serverless functions.

export function sendJson(res, status, body, { cdnSeconds = 60, swr = 300 } = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Vercel's edge CDN caches successful GETs so Yahoo is hit rarely.
  if (status === 200) {
    res.setHeader('Cache-Control', `public, s-maxage=${cdnSeconds}, stale-while-revalidate=${swr}`);
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.status(status).send(JSON.stringify(body));
}

export function ok(res, data, opts) {
  sendJson(res, 200, { ok: true, data, generatedAt: new Date().toISOString() }, opts);
}

export function fail(res, status, message, extra = {}) {
  sendJson(res, status, { ok: false, error: message, ...extra });
}

export const qp = (req, key, def = undefined) => {
  const v = req.query?.[key];
  if (v === undefined || v === '') return def;
  return Array.isArray(v) ? v[0] : v;
};
