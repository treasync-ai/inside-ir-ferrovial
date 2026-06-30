// SPA router. Hash routes mount one page module into <main id="app">.
import dashboard from './pages/dashboard.js';
import share from './pages/share.js';
import financials from './pages/financials.js';
import calendar from './pages/calendar.js';
import news from './pages/news.js';
import peers from './pages/peers.js';
import valuation from './pages/valuation.js';
import guide from './pages/guide.js';

const routes = { dashboard, share, financials, calendar, news, peers, valuation, guide };
const DEFAULT = 'dashboard';

const app = document.getElementById('app');

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  return routes[h] ? h : DEFAULT;
}

function setActiveTab(name) {
  document.querySelectorAll('#tabs a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === `#/${name}`);
  });
}

async function mount() {
  const name = currentRoute();
  setActiveTab(name);
  app.innerHTML = '<div class="loading">Loading…</div>';
  window.scrollTo(0, 0);
  try {
    await routes[name](app);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="err">Something went wrong rendering this page: ${err.message}.
      Live data needs the Vercel runtime — try refreshing, or run <code>vercel dev</code> locally.</div>`;
  }
}

window.addEventListener('hashchange', mount);
window.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) location.replace('#/dashboard');
  mount();
});
// In case DOMContentLoaded already fired (module timing)
if (document.readyState !== 'loading') {
  if (!location.hash) location.hash = '#/dashboard'; else mount();
}
