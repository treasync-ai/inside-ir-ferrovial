import { data } from '../api.js';
import { esc } from '../util.js';
import { pageHead, callout } from '../ui.js';

export default async function render(root) {
  const c = await data('company.json').catch(() => null);

  root.innerHTML = pageHead('Guide', 'How to use Inside IR Ferrovial, how it was built, and why it maps to the Investor Relations Analyst role.') +
    `<div class="grid g2">
      <div class="card">
        <h3>What this is</h3>
        <p class="small">A single-page Investor Relations cockpit for <b>Ferrovial SE (FER)</b> that tracks the share across its three listings — <b>Nasdaq, BME Madrid and Euronext Amsterdam</b> — and brings valuation, financials, peers, calendar and news into one place. It is an <b>infinite, always-on improvement</b> on a static IR web page: the market data refreshes itself; the valuation is interactive.</p>
        ${callout('Built by David Vargas', 'A working demonstration of the skill set this role needs: monitoring the share across markets, building light models, automating reporting/news, and telling the equity story clearly.')}
      </div>
      <div class="card">
        <h3>How to use it — tab by tab</h3>
        <ul class="small">
          <li><b>📊 Dashboard</b> — market sentiment, the three listings’ key stats (OHLC, volume, market cap, net &amp; % change), an interactive price chart, returns over every window (1D→5Y), YTD price &amp; dividend return, and latest news.</li>
          <li><b>📈 Share</b> — the three listings in detail, technical analysis (RSI &amp; moving averages with buy/sell context), credit ratings (S&amp;P, Fitch, Moody’s), debt issuance and total shareholder return.</li>
          <li><b>📒 Financials</b> — Ferrovial’s reported KPIs over several years plus detailed IFRS statements (annual / quarterly).</li>
          <li><b>🗓️ Calendar</b> — upcoming earnings, dividends and milestones.</li>
          <li><b>📰 News</b> — auto-aggregated, deduplicated, refreshed daily.</li>
          <li><b>⚖️ Peers</b> — Ferrovial vs Vinci, Eiffage, ACS, Sacyr, Transurban and Aena on valuation multiples.</li>
          <li><b>🧮 Valuation</b> — interactive <b>DCF</b> and <b>Sum-of-the-Parts</b>: move WACC, interest rates, growth and multiples and watch the implied value move.</li>
        </ul>
      </div>
    </div>

    <div class="card mt">
      <h3>How I built it — the stack</h3>
      <div class="grid g3 mt8">
        <div><b>Frontend</b><p class="small">Vanilla JavaScript single-page app (hash router, no framework) with Chart.js. Theme in Ferrovial’s white / gray / yellow. Easy to read and edit.</p></div>
        <div><b>Data pipeline</b><p class="small">A scheduled GitHub Action fetches Yahoo Finance from Azure runners (Yahoo blocks Vercel's IPs but not GitHub's) and commits static JSON snapshots the app reads directly. No serverless functions, no API keys.</p></div>
        <div><b>Data</b><p class="small">Yahoo Finance for prices, history, technicals, fundamentals, peers and news; curated JSON for the SOTP/DCF model, credit ratings and IR KPIs.</p></div>
      </div>
    </div>

    <div class="card mt">
      <h3>Why it maps to the Investor Relations Analyst role</h3>
      <div class="tbl-wrap" style="box-shadow:none"><table class="data"><thead><tr><th style="text-align:left">Job responsibility</th><th style="text-align:left">Where it shows up here</th></tr></thead>
      <tbody>
        ${[
          ['Market & peer intelligence — track price/volume drivers, ownership, peer benchmarking', 'Dashboard, Share, Peers'],
          ['Financial analysis — build & maintain light models/tables', 'Valuation (DCF & SOTP), Financials'],
          ['Monitoring & reporting — daily/weekly market summaries', 'Dashboard + automated News'],
          ['Monitor Ferrovial’s valuation and provide reports to management', 'Valuation page — interactive, explainable'],
          ['IR infrastructure — website, FAQs, mailing workflows', 'This app + curated data files'],
          ['Shareholder targeting & US investor-base expansion', 'Three-market tracking; Nasdaq front-and-center']
        ].map((r) => `<tr><td style="text-align:left">${esc(r[0])}</td><td style="text-align:left"><span class="pill y">${esc(r[1])}</span></td></tr>`).join('')}
      </tbody></table></div>
    </div>

    <div class="card mt">
      <h3>Data sources & methodology</h3>
      <ul class="small">
        <li><b>Live market data:</b> Yahoo Finance (unofficial), with Finnhub as an optional second source for news. Cached at the edge so providers are queried sparingly.</li>
        <li><b>Curated figures:</b> Ferrovial FY2025 results &amp; Q1 2026 trading update, financial statements, and sell-side research, as of 30 June 2026.</li>
        <li><b>Valuation model:</b> 407 ETR via finite dividend-discount; US Managed Lanes via proportionate EV/EBITDA; Airports on invested-equity multiples; Construction on EV/EBIT; the rest at market / transaction value. Defaults are calibrated to roughly reproduce the ~€43bn equity value so sliders show <i>sensitivity</i>.</li>
      </ul>
      ${callout('Disclaimer', esc(c?.disclaimer || 'Educational / interview-prep tool. Not investment advice and not official Ferrovial material. Verify all figures before quoting.'), 'gray')}
    </div>`;
}
