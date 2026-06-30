// GET /api/calendar → live corporate events.
// Yahoo's calendar lives behind the crumbed quoteSummary endpoint (blocked from
// serverless IPs), so the live feed is intentionally empty here and the frontend
// renders the curated cadence baseline (data/calendar-baseline.json).
import { ok } from './_lib/http.js';

export default async function handler(req, res) {
  return ok(res, { events: [], note: 'Live earnings dates require the crumbed Yahoo endpoint; the app uses the curated cadence baseline instead.' }, { cdnSeconds: 3600, swr: 21600 });
}
