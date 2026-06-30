// Central configuration: Ferrovial's three listings + the peer set.
// Ferrovial SE trades the SAME share, fungibly, on three venues.

// Shares outstanding (approx) for market-cap = price × shares, since the
// crumbless chart endpoint does not return market cap. Editable.
export const SHARES = {
  'FER': 729555372, 'FER.MC': 729555372, 'FER.AS': 729555372,
  'DG.PA': 580000000, 'FGR.PA': 95000000, 'ACS.MC': 255000000,
  'SCYR.MC': 720000000, 'TCL.AX': 3085000000, 'AENA.MC': 150000000
};

export const FERROVIAL = {
  name: 'Ferrovial SE',
  listings: [
    { key: 'US', symbol: 'FER',    market: 'Nasdaq',            mic: 'XNAS', currency: 'USD', flag: '🇺🇸', tz: 'America/New_York' },
    { key: 'ES', symbol: 'FER.MC', market: 'BME (Madrid)',      mic: 'XMAD', currency: 'EUR', flag: '🇪🇸', tz: 'Europe/Madrid' },
    { key: 'NL', symbol: 'FER.AS', market: 'Euronext Amsterdam', mic: 'XAMS', currency: 'EUR', flag: '🇳🇱', tz: 'Europe/Amsterdam' }
  ],
  // Primary symbol used for fundamentals / charts when one is enough.
  primary: 'FER.MC'
};

// "Mix infra" peer set chosen by the user: concessions + construction + airports.
export const PEERS = [
  { symbol: 'FER.MC',  name: 'Ferrovial',  currency: 'EUR', type: 'Concessions / Construction', self: true },
  { symbol: 'DG.PA',   name: 'Vinci',      currency: 'EUR', type: 'Concessions / Construction' },
  { symbol: 'FGR.PA',  name: 'Eiffage',    currency: 'EUR', type: 'Concessions / Construction' },
  { symbol: 'ACS.MC',  name: 'ACS',        currency: 'EUR', type: 'Construction / Services' },
  { symbol: 'SCYR.MC', name: 'Sacyr',      currency: 'EUR', type: 'Concessions / Construction' },
  { symbol: 'TCL.AX',  name: 'Transurban', currency: 'AUD', type: 'Toll roads (pure-play)' },
  { symbol: 'AENA.MC', name: 'Aena',       currency: 'EUR', type: 'Airports' }
];

export const ALL_SYMBOLS = [...new Set([...FERROVIAL.listings.map(l => l.symbol), ...PEERS.map(p => p.symbol)])];

export const symbolMeta = (sym) => {
  const l = FERROVIAL.listings.find(x => x.symbol === sym);
  if (l) return { ...l, name: 'Ferrovial' };
  const p = PEERS.find(x => x.symbol === sym);
  return p ? { ...p, key: p.symbol } : { symbol: sym, currency: 'EUR', name: sym };
};
