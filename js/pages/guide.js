import { data } from '../api.js';
import { esc } from '../util.js';
import { pageHead, callout } from '../ui.js';

export default async function render(root) {
  const c = await data('company.json').catch(() => null);

  root.innerHTML = pageHead('Guide', 'What Inside IR Ferrovial is, how to use each section, and how it is built.') +
    `<div class="grid g2">
      <div class="card">
        <h3>What this is</h3>
        <p class="small">An independent, single-page <b>Investor Relations cockpit</b> for <b>Ferrovial SE (FER)</b> that tracks the share across its three fungible listings — <b>Nasdaq, BME Madrid and Euronext Amsterdam</b> — and brings sentiment, valuation, financials, analyst coverage, dividends, peers, calendar and news into one always-on place. The market data refreshes itself; the valuation is interactive.</p>
        ${callout('Why it’s useful for IR', 'One screen to monitor the share across all three markets, track the sell-side view and the dividend, benchmark peers, and walk anyone through the equity story and valuation — without juggling terminals.')}
      </div>
      <div class="card">
        <h3>How to use it — section by section</h3>
        <ul class="small">
          <li><b>📊 Dashboard</b> — momentum sentiment, the three listings’ key stats (OHLC, volume, market cap, net &amp; % change), an interactive price chart, returns over every window (1D→5Y), YTD price &amp; dividend return, and latest news.</li>
          <li><b>📈 Share</b> — the three listings in detail, technical analysis (RSI &amp; moving averages), <b>dividends</b> (history, yield), credit ratings (S&amp;P, Fitch, Moody’s), debt issuance and total shareholder return.</li>
          <li><b>🎯 Analysts</b> — recommendation consensus (Strong Buy→Sell bar), 12-month price-target range vs current, and a <b>heatmap</b> of covering firms by rating.</li>
          <li><b>📒 Financials</b> — Ferrovial’s reported KPIs over several years plus detailed IFRS statements (annual / quarterly).</li>
          <li><b>🗓️ Calendar</b> — upcoming earnings, dividends and milestones.</li>
          <li><b>📰 News</b> — auto-aggregated, deduplicated, refreshed daily.</li>
          <li><b>⚖️ Peers</b> — Ferrovial vs Vinci, Eiffage, ACS, Sacyr, Transurban and Aena.</li>
          <li><b>🧮 Valuation</b> — interactive <b>DCF</b> and <b>Sum-of-the-Parts</b>: move WACC, interest rates, growth and multiples and watch the implied value move (with on-page instructions).</li>
        </ul>
      </div>
    </div>

    <div class="card mt">
      <h3>How it’s built</h3>
      <div class="grid g3 mt8">
        <div><b>Frontend</b><p class="small">Vanilla JavaScript single-page app (hash router, no framework) with Chart.js, served statically by Vercel. Ferrovial white / gray / yellow theme. Easy to read and edit.</p></div>
        <div><b>Data pipeline</b><p class="small">A scheduled GitHub Action runs <code>yfinance</code> on GitHub’s Azure runners (Yahoo blocks Vercel’s IPs but not GitHub’s) and commits static JSON snapshots the app reads directly. No serverless functions, no API keys, no secrets.</p></div>
        <div><b>Data</b><p class="small">Yahoo Finance for prices, history, technicals, fundamentals, analyst coverage, dividends, peers and news; curated JSON for the SOTP/DCF model, credit ratings and IR KPIs.</p></div>
      </div>
    </div>

    <div class="card mt">
      <h3>Data sources &amp; methodology</h3>
      <ul class="small">
        <li><b>Live market data:</b> Yahoo Finance via the scheduled fetcher; the browser reads the committed snapshots from GitHub’s CDN, so data updates without redeploying.</li>
        <li><b>Curated figures:</b> Ferrovial FY2025 results &amp; Q1 2026 trading update, financial statements, and sell-side research, as of 30 June 2026.</li>
        <li><b>Valuation model:</b> 407 ETR via finite dividend-discount; US Managed Lanes via proportionate EV/EBITDA; Airports on invested-equity multiples; Construction on EV/EBIT; the rest at market / transaction value. Defaults are calibrated to roughly reproduce the ~€43bn equity value so sliders show <i>sensitivity</i>.</li>
        <li><b>Analyst &amp; peer multiples:</b> recommendation distribution and price targets are live; the firm-level heatmap and peer P/E &amp; EV/EBITDA blend live data with curated indicative figures (~mid-2026) where the free feed doesn’t expose them.</li>
      </ul>
      ${callout('Disclaimer', esc(c?.disclaimer || 'An independent IR analytics tool. Not investment advice and not official Ferrovial material. Verify all figures before quoting.'), 'gray')}
      <p class="small muted" style="margin-top:8px">Built by David Vargas Sarasqueta.</p>
    </div>`;
}
