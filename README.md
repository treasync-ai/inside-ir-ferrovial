# Inside IR · Ferrovial

An always-on **Investor Relations cockpit** for **Ferrovial SE (FER)** — an infinite improvement on a static IR web page. It tracks the share across its three fungible listings (**Nasdaq · BME Madrid · Euronext Amsterdam**) and brings sentiment, valuation, financials, peers, calendar and news into one fast single-page app.

Built by **David Vargas Sarasqueta** as an interview-prep / portfolio project for the Ferrovial Investor Relations Analyst role.

> Educational tool. **Not investment advice and not official Ferrovial material.**

---

## Features

| Tab | What it does |
|-----|--------------|
| **📊 Dashboard** | Market-sentiment gauge, the three listings’ key stats (OHLC, volume, market cap, net & % change), interactive price chart, returns for 1D→5Y, YTD price **and** dividend return, latest news. |
| **📈 Share** | The three listings in detail, technical analysis (RSI + moving averages with trend context), credit ratings (S&P / Fitch / Moody’s), debt issuance, total shareholder return. |
| **📒 Financials** | Ferrovial’s reported KPIs (multi-year) + detailed IFRS statements (annual / quarterly). |
| **🗓️ Calendar** | Upcoming earnings, dividends and milestones (live estimate + curated cadence). |
| **📰 News** | Auto-aggregated, deduplicated Ferrovial headlines, refreshed daily. |
| **⚖️ Peers** | Ferrovial vs Vinci, Eiffage, ACS, Sacyr, Transurban, Aena on valuation multiples. |
| **🧮 Valuation** | Interactive **DCF** and **Sum-of-the-Parts** — move WACC, interest rates, growth and multiples and watch the implied value react. |
| **📖 Guide** | How to use it, how it was built, and how it maps to the IR role. |

## Tech stack

- **Frontend:** vanilla JavaScript single-page app (hash router, no framework) + [Chart.js](https://www.chartjs.org/). Theme in Ferrovial white / gray / yellow.
- **Backend:** Node.js **serverless functions** on Vercel (`/api/*`) with caching, retry/backoff and graceful fallbacks. No secrets in the browser.
- **Data:** [Yahoo Finance](https://github.com/gadicc/node-yahoo-finance2) (prices, history, technicals, fundamentals, peers, calendar); optional [Finnhub](https://finnhub.io/) for news; curated JSON for the SOTP/DCF model, ratings and IR KPIs.

## Project structure

```
inside-ir-ferrovial/
├── api/                # Vercel serverless functions
│   ├── _lib/           # config (listings, peers), yahoo wrapper, cache, finnhub, http helpers
│   ├── quotes.js  history.js  technicals.js  financials.js
│   └── news.js    peers.js    calendar.js
├── index.html          # SPA shell
├── css/styles.css      # theme
├── js/                 # app.js (router), api.js, util.js, charts.js, ui.js, pages/*
├── data/               # curated JSON: company, ratings, sotp, financials-baseline, calendar-baseline
├── scripts/test-data.js
├── vercel.json
└── package.json
```

## Run locally

```bash
npm install
npm i -g vercel        # first time only
vercel dev             # serves the static site + /api functions at http://localhost:3000
```

> Opening `index.html` directly as a file won’t run the `/api` functions. Use `vercel dev` (or deploy) for live data. The Valuation, Financials (curated KPIs) and Guide pages work from local JSON regardless.

Quick data sanity check (hits Yahoo directly):

```bash
npm run test:data
```

## Deploy to Vercel

1. Push this repo to GitHub (already done if you’re reading this on GitHub).
2. Go to **[vercel.com/new](https://vercel.com/new)** → **Import** this repository.
3. Framework preset: **Other**. Leave build settings empty. Click **Deploy**.
4. (Optional) Add the Finnhub key for richer news — see below.

That’s it: static files are served from the root and `api/*.js` become serverless functions automatically.

## Environment variables (optional)

The app runs fully **without any keys**. To enrich the News feed:

| Variable | How to get it |
|----------|----------------|
| `FINNHUB_API_KEY` | Free at [finnhub.io/register](https://finnhub.io/register) (takes ~1 min). Add it in **Vercel → Project → Settings → Environment Variables**, then redeploy. |

## Customize

- **Peer set:** `api/_lib/config.js` → `PEERS`.
- **Curated figures / model:** edit the JSON in `data/` (`sotp.json`, `ratings.json`, `financials-baseline.json`, `company.json`, `calendar-baseline.json`). No build step — just edit and redeploy.
- **Theme:** CSS variables at the top of `css/styles.css`.

## Data & methodology

Live market data via Yahoo Finance (and Finnhub when configured), cached at the edge so providers are queried sparingly. Curated figures are from Ferrovial’s FY2025 results, Q1 2026 trading update, financial statements and sell-side research **as of 30 June 2026** — verify before quoting. The valuation defaults are calibrated to roughly reproduce Ferrovial’s ~€43bn equity value so the sliders demonstrate *sensitivity*, not a price target.

## License

MIT © 2026 David Vargas Sarasqueta
