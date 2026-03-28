import { router } from './router.js';

// ── Nav config ───────────────────────────────────────
const NAV = [
  {
    route: '/',
    href: '#/',
    label: 'Головна',
    icon: `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  },
  {
    route: '/calendar',
    href: '#/calendar',
    label: 'Календар',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2"/>
           <line x1="16" y1="2" x2="16" y2="6"/>
           <line x1="8" y1="2" x2="8" y2="6"/>
           <line x1="3" y1="10" x2="21" y2="10"/>`,
  },
  {
    route: '/magazines',
    href: '#/magazines',
    label: 'Журнали',
    icon: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
           <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  },
  {
    route: '/series',
    href: '#/series',
    label: 'Серії',
    icon: `<line x1="8" y1="6" x2="21" y2="6"/>
           <line x1="8" y1="12" x2="21" y2="12"/>
           <line x1="8" y1="18" x2="21" y2="18"/>
           <line x1="3" y1="6" x2="3.01" y2="6"/>
           <line x1="3" y1="12" x2="3.01" y2="12"/>
           <line x1="3" y1="18" x2="3.01" y2="18"/>`,
  },
];

const icon = (d) =>
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${d}</svg>`;

// ── Shell mount ──────────────────────────────────────
/**
 * Renders header + main + footer into #app.
 * Returns the <main> element for view injection.
 */
export function initShell() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <header class="site-header">
      <div class="container">
        <a class="header-logo" href="#/">
          <div class="logo-mark">M</div>
          <div>
            <div class="logo-text">Manga<span>Cal</span></div>
            <div class="logo-sub">Календар виходу серій</div>
          </div>
        </a>

        <nav class="header-nav" id="main-nav">
          ${NAV.map(({ route, href, label, icon: d }) =>
            `<a class="nav-link" data-route="${route}" href="${href}">
              ${icon(d)}<span>${label}</span>
            </a>`
          ).join('')}
        </nav>

        <div class="header-actions">
          <button class="btn-icon" id="theme-btn" title="Змінити тему"></button>
        </div>
      </div>
    </header>

    <main data-shell-main></main>

    <footer class="site-footer">
      <div class="container">
        MangaCal · Дані: MangaDex, AniList, Shueisha, Shogakukan, Kodansha
      </div>
    </footer>
  `;

  initTheme();
  router.onChange(syncActiveNav);

  return document.querySelector('[data-shell-main]');
}

// ── Active nav ───────────────────────────────────────
function syncActiveNav(path) {
  document.querySelectorAll('.nav-link[data-route]').forEach(el => {
    const r = el.dataset.route;
    const active = r === '/' ? path === '/' : path.startsWith(r);
    el.classList.toggle('active', active);
  });
}

// ── Theme ────────────────────────────────────────────
const THEME_KEY = 'mangacal-theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) ?? 'dark';
  document.documentElement.dataset.theme = saved;

  const btn = document.getElementById('theme-btn');
  const syncIcon = () => {
    btn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙';
  };
  syncIcon();

  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    syncIcon();
  });
}