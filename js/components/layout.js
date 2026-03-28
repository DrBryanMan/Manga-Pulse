'use strict';

const STORAGE_KEY = 'mp-theme';

const NAV_ITEMS = [
  {
    id: 'home',
    href: 'index.html',
    label: 'Головна',
    icon: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    `,
  },
  {
    id: 'calendar',
    href: 'index.html#calendar',
    label: 'Календар',
    icon: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    `,
  },
  {
    id: 'magazines',
    href: 'index.html#magazines',
    label: 'Журнали',
    icon: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    `,
  },
  {
    id: 'series',
    href: 'index.html#series',
    label: 'Серії',
    icon: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    `,
  },
];

const getHeaderMarkup = () => `
  <div class="container">
    <a class="header-logo" href="index.html" aria-label="Manga Pulse">
      <img class="logo-mark" src="logo-pulse.svg" alt="Manga Pulse">
      <div>
        <div class="logo-text">Manga <span>Pulse</span></div>
        <div class="logo-sub">マンガパルス</div>
      </div>
    </a>

    <nav class="header-nav" aria-label="Головна навігація">
      ${NAV_ITEMS.map(item => `
        <a class="nav-link" data-nav="${item.id}" href="${item.href}">
          ${item.icon}
          <span>${item.label}</span>
        </a>
      `).join('')}
    </nav>

    <div class="header-actions">
      <button class="btn-icon" id="theme-btn" type="button" title="Змінити тему" aria-label="Змінити тему"></button>
    </div>
  </div>
`;

const getFooterMarkup = () => `
  <div class="container">
    Manga Pulse · Дані: MangaDex, AniList, Shueisha, Shogakukan, Kodansha
  </div>
`;

export const applyTheme = theme => {
  document.documentElement.dataset.theme = theme;

  const button = document.getElementById('theme-btn');
  const isDarkTheme = theme === 'dark';

  if (button) {
    button.textContent = isDarkTheme ? '☀️' : '🌙';
    button.title = isDarkTheme ? 'Перемкнути на світлу тему' : 'Перемкнути на темну тему';
    button.setAttribute('aria-label', button.title);
  }

  localStorage.setItem(STORAGE_KEY, theme);
};

export const toggleTheme = () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
};

export const renderSiteShell = () => {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');

  if (header && !header.dataset.ready) {
    header.innerHTML = getHeaderMarkup();
    header.dataset.ready = 'true';
  }

  if (footer && !footer.dataset.ready) {
    footer.innerHTML = getFooterMarkup();
    footer.dataset.ready = 'true';
  }
};

export const setupThemeToggle = () => {
  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);
};

export const setActiveNav = page => {
  document.querySelectorAll('.nav-link[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === page);
  });
};
