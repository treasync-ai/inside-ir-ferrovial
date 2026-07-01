# Inside IR · Ferrovial

An always-on **Investor Relations cockpit** for **Ferrovial SE (FER)** — an infinite improvement on a static IR web page. It tracks the share across its three fungible listings (**Nasdaq · BME Madrid · Euronext Amsterdam**) and brings sentiment, valuation, financials, peers, calendar and news into one fast single-page app.

Built by **David Vargas Sarasqueta** — an independent investor-relations analytics tool for Ferrovial SE (FER).

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
| **⚖️ Peers** | Ferrovial vs Vinci, Bouygues, Sacyr, Acciona, Eiffage, Aena, OHLA on valuation multiples + 3-year relative return. |
| **🧮 Valuation** | Interactive **DCF** and **Sum-of-the-Parts** — move WACC, interest rates, growth and multiples and watch the implied value react. |
| **📖 Guide** | How to use it, how it was built, and how it maps to the IR role. |

## Tech stack

- **Frontend:** vanilla JavaScript single-page app (hash router, no framework) + [Chart.js](https://www.chartjs.org/), served statically by Vercel. Theme in Ferrovial white / gray / yellow.
- **Data pipeline:** a scheduled **GitHub Action** (`.github/workflows/refresh-data.yml`) runs `scripts/fetch-data.js` on GitHub's **Azure runners** — where Yahoo Finance is *not* IP-blocked (it blocks Vercel's AWS IPs) — and commits the results as static JSON to `/data/live`. The browser reads those files directly. **No serverless functions, no API keys, no secrets.**
- **Data sources:** Yahoo Finance (prices, history, technicals, fundamentals, peers, news) via the Action; curated JSON for the SOTP/DCF model, credit ratings, IR KPIs and indicative peer multiples.

## Project structure

```
inside-ir-ferrovial/
├── .github/workflows/refresh-data.yml   # scheduled data fetcher (the "backend")
├── api/_lib/            # config (listings, peers) + Yahoo REST client used by the fetcher
├── scripts/fetch-data.js # pulls Yahoo → writes data/live/*.json
├── index.html           # SPA shell
├── css/styles.css       # theme
├── js/                  # app.js (router), api.js, util.js, charts.js, ui.js, pages/*
├── data/                # curated JSON (company, ratings, sotp, financials-baseline, …)
│   └── live/            # auto-generated market snapshots (committed by the Action)
├── vercel.json
└── package.json
```

## How live data works (no API keys)

Yahoo Finance **blocks Vercel's serverless IPs** (AWS) but **not GitHub Actions runners** (Azure). So:

1. `.github/workflows/refresh-data.yml` runs `node scripts/fetch-data.js` on a schedule (every 30 min, market hours).
2. The script pulls quotes / history / technicals / fundamentals / peers / news from Yahoo and writes `data/live/*.json`.
3. It commits those files; Vercel redeploys and serves them from its CDN.
4. The browser reads `/data/live/*.json` directly — fast, static, keyless.

Run the fetcher manually anytime from the repo's **Actions → Refresh market data → Run workflow**, or locally with `node scripts/fetch-data.js` (from a non-blocked IP).

## Deploy to Vercel

1. Import the repo at **[vercel.com/new](https://vercel.com/new)**.
2. Framework preset: **Other**. Leave build settings empty. **Deploy**.
3. Enable the GitHub Action (it's in the repo) and run it once so `data/live` is populated.

No environment variables. No API keys.

## Customize

- **Peer set:** `api/_lib/config.js` → `PEERS` (and `PEER_MULTIPLES`, `SHARES`).
- **Refresh frequency:** the `cron` in `.github/workflows/refresh-data.yml`.
- **Curated figures / model:** edit the JSON in `data/` (`sotp.json`, `ratings.json`, `financials-baseline.json`, `company.json`, `calendar-baseline.json`).
- **Theme:** CSS variables at the top of `css/styles.css`.

## Data & methodology

Live market data from Yahoo Finance, refreshed by the scheduled Action. Curated figures are from Ferrovial’s FY2025 results, Q1 2026 trading update, financial statements and sell-side research **as of 30 June 2026** — verify before quoting. Peer P/E and EV/EBITDA are curated indicative figures where the free data doesn't expose them. The valuation defaults are calibrated to roughly reproduce Ferrovial’s ~€43bn equity value so the sliders demonstrate *sensitivity*, not a price target.

## License

MIT © 2026 David Vargas Sarasqueta
