// GET /api/calendar → upcoming corporate events from Yahoo (earnings, dividends).
// The frontend merges this with a curated baseline of known IR dates.
import { summary } from './_lib/yahoo.js';
import { withCache } from './_lib/cache.js';
import { ok, fail } from './_lib/http.js';
import { FERROVIAL } from './_lib/config.js';

export default async function handler(req, res) {
  try {
    const data = await withCache('calendar:v1', 60 * 60 * 6, async () => {
      const events = [];
      try {
        const s = await summary(FERROVIAL.primary, ['calendarEvents', 'price']);
        const ce = s.calendarEvents || {};
        const eDates = ce.earnings?.earningsDate || [];
        eDates.forEach((d) => events.push({
          type: 'Earnings', title: 'Earnings (Yahoo estimate)',
          date: new Date(d).toISOString().slice(0, 10), source: 'Yahoo'
        }));
        if (ce.earnings?.earningsAverage != null)
          events.push({ type: 'EPS estimate', title: `Consensus EPS est. ${ce.earnings.earningsAverage}`, date: null, source: 'Yahoo' });
        if (ce.exDividendDate) events.push({ type: 'Ex-dividend', title: 'Ex-dividend date', date: new Date(ce.exDividendDate).toISOString().slice(0, 10), source: 'Yahoo' });
        if (ce.dividendDate) events.push({ type: 'Dividend pay', title: 'Dividend payment', date: new Date(ce.dividendDate).toISOString().slice(0, 10), source: 'Yahoo' });
      } catch { /* fall back to curated only (frontend) */ }
      return { events };
    });
    return ok(res, data, { cdnSeconds: 3600, swr: 21600 });
  } catch (err) {
    return fail(res, 502, 'Could not load calendar', { detail: String(err?.message || err) });
  }
}
