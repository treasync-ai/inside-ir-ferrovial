// Twelve Data provider (https://twelvedata.com) — free tier works from serverless
// IPs where Yahoo is blocked. Enabled when TWELVEDATA_API_KEY is set.
// Symbols are disambiguated by MIC code (Ferrovial trades as "FER" on 3 venues).
const KEY = process.env.TWELVEDATA_API_KEY || '';
const BASE = 'https://api.twelvedata.com';

export const tdEnabled = () => Boolean(KEY);

// Our internal symbol -> { symbol, mic } for Twelve Data.
export const TD_MAP = {
  'FER': { symbol: 'FER', mic: 'XNGS' },     // Nasdaq
  'FER.MC': { symbol: 'FER', mic: 'XMAD' },  // BME Madrid
  'FER.AS': { symbol: 'FER', mic: 'XAMS' },  // Euronext Amsterdam
  'DG.PA': { symbol: 'DG', mic: 'XPAR' },     // Vinci
  'FGR.PA': { symbol: 'FGR', mic: 'XPAR' },   // Eiffage
  'ACS.MC': { symbol: 'ACS', mic: 'XMAD' },   // ACS
  'SCYR.MC': { symbol: 'SCYR', mic: 'XMAD' }, // Sacyr
  'TCL.AX': { symbol: 'TCL', mic: 'XASX' },   // Transurban
  'AENA.MC': { symbol: 'AENA', mic: 'XMAD' }  // Aena
};

const num = (v) => (v == null || v === '' || isNaN(v)) ? null : Number(v);

async function td(path, params) {
  if (!KEY) throw new Error('TWELVEDATA_API_KEY not configured');
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  url.searchParams.set('apikey', KEY);
  const r = await fetch(url);
  const j = await r.json();
  if (j.status === 'error') throw new Error('TwelveData: ' + (j.message || j.code));
  return j;
}

export async function tdQuote(internalSymbol) {
  const m = TD_MAP[internalSymbol]; if (!m) throw new Error('No TD mapping for ' + internalSymbol);
  const q = await td('/quote', { symbol: m.symbol, mic_code: m.mic });
  const price = num(q.close), prev = num(q.previous_close);
  return {
    symbol: internalSymbol, currency: q.currency || null,
    price, prevClose: prev, open: num(q.open), dayHigh: num(q.high), dayLow: num(q.low),
    volume: num(q.volume) ?? num(q.average_volume),
    week52High: num(q.fifty_two_week?.high), week52Low: num(q.fifty_two_week?.low),
    change: num(q.change), changePercent: num(q.percent_change),
    exchange: q.exchange || null, marketState: q.is_market_open ? 'OPEN' : 'CLOSED'
  };
}

// Ascending [{date:Date, open,high,low,close,volume}]
export async function tdSeries(internalSymbol, { interval = '1day', outputsize = 1300 } = {}) {
  const m = TD_MAP[internalSymbol]; if (!m) throw new Error('No TD mapping for ' + internalSymbol);
  const j = await td('/time_series', { symbol: m.symbol, mic_code: m.mic, interval, outputsize, order: 'ASC' });
  const values = j.values || [];
  return {
    currency: j.meta?.currency || null,
    series: values.map((v) => ({
      date: new Date(v.datetime.length <= 10 ? v.datetime + 'T00:00:00Z' : v.datetime.replace(' ', 'T') + 'Z'),
      open: num(v.open), high: num(v.high), low: num(v.low), close: num(v.close), volume: num(v.volume)
    })).filter((p) => p.close != null)
  };
}
