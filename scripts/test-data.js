// Quick probe of the data sources we plan to use. Run: node scripts/test-data.js
import yahooFinance from 'yahoo-finance2';

const log = (t, v) => console.log(`\n=== ${t} ===\n` + (typeof v === 'string' ? v : JSON.stringify(v, null, 2)));

async function main() {
  // 1) Quotes for the 3 listings
  const symbols = ['FER', 'FER.MC', 'FER.AS'];
  for (const s of symbols) {
    try {
      const q = await yahooFinance.quote(s);
      log(`quote ${s}`, {
        currency: q.currency, price: q.regularMarketPrice, prevClose: q.regularMarketPreviousClose,
        open: q.regularMarketOpen, dayHigh: q.regularMarketDayHigh, dayLow: q.regularMarketDayLow,
        vol: q.regularMarketVolume, mcap: q.marketCap, chg: q.regularMarketChange, chgPct: q.regularMarketChangePercent,
        exch: q.fullExchangeName, name: q.shortName, pe: q.trailingPE, divYield: q.trailingAnnualDividendYield
      });
    } catch (e) { log(`quote ${s} ERROR`, e.message); }
  }

  // 2) Chart history (for returns + charts)
  try {
    const c = await yahooFinance.chart('FER.MC', { period1: '2024-01-01', interval: '1d' });
    log('chart FER.MC count', c.quotes.length);
    log('chart sample', c.quotes.slice(0, 2));
  } catch (e) { log('chart ERROR', e.message); }

  // 3) quoteSummary modules: financials, calendar, recommendations
  try {
    const qs = await yahooFinance.quoteSummary('FER.MC', {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'calendarEvents',
                'recommendationTrend', 'incomeStatementHistory', 'balanceSheetHistory',
                'cashflowStatementHistory', 'price']
    });
    log('financialData', qs.financialData);
    log('calendarEvents', qs.calendarEvents);
    log('recommendationTrend', qs.recommendationTrend?.trend?.slice(0,1));
    log('incomeStatementHistory years', qs.incomeStatementHistory?.incomeStatementHistory?.map(x => x.endDate));
    log('keyStats', { ev: qs.defaultKeyStatistics?.enterpriseValue, evEbitda: qs.defaultKeyStatistics?.enterpriseToEbitda, beta: qs.defaultKeyStatistics?.beta });
  } catch (e) { log('quoteSummary ERROR', e.message); }

  // 4) fundamentalsTimeSeries (deeper multi-year financials)
  try {
    const f = await yahooFinance.fundamentalsTimeSeries('FER.MC', {
      period1: '2018-01-01', type: 'annual',
      module: 'financials'
    });
    log('fundamentalsTimeSeries len', f.length);
    log('fundamentalsTimeSeries sample', f.slice(0,1));
  } catch (e) { log('fundamentalsTimeSeries ERROR', e.message); }

  // 5) Peers quotes
  try {
    const peers = ['DG.PA','FGR.PA','ACS.MC','SCYR.MC','TCL.AX','AENA.MC'];
    const pq = await yahooFinance.quote(peers);
    log('peers', pq.map(p => ({ s: p.symbol, name: p.shortName, ccy: p.currency, pe: p.trailingPE, mcap: p.marketCap })));
  } catch (e) { log('peers ERROR', e.message); }

  // 6) Search/news
  try {
    const r = await yahooFinance.search('Ferrovial', { newsCount: 5, quotesCount: 0 });
    log('news', r.news?.map(n => ({ title: n.title, pub: n.publisher, link: n.link })));
  } catch (e) { log('news ERROR', e.message); }
}
main();
