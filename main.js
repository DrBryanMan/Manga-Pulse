'use strict';

import { initImageFallbacks } from './js/components/image-fallback.js';
import { applyTheme, renderSiteShell, setActiveNav, setupThemeToggle, toggleTheme } from './js/components/layout.js';
import { renderSeriesView } from './js/views/series.js';

window.toggleTheme = toggleTheme;

const DEFAULT_ROUTE = 'home';
const SUPPORTED_ROUTES = new Set(['home', 'calendar', 'magazines', 'series']);

const getRoute = () => {
  const rawRoute = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  return rawRoute && SUPPORTED_ROUTES.has(rawRoute) ? rawRoute : DEFAULT_ROUTE;
};

const renderPlaceholderView = route => `
  <div class="container page-body">
    <section class="series-empty">
      <div class="series-empty-title">Розділ готується</div>
      <p class="series-empty-text">View <strong>${route}</strong> ще не реалізований у SPA.</p>
    </section>
  </div>
`;

const renderRoute = async () => {
  const route = getRoute();
  const homeHero = document.getElementById('home-hero');
  const homeMain = document.getElementById('home-main');
  const spaView = document.getElementById('spa-view');

  document.body.dataset.page = route;

  if (route === 'home') {
    homeHero?.classList.remove('hidden');
    homeMain?.classList.remove('hidden');
    spaView?.classList.add('hidden');
    if (spaView) spaView.innerHTML = '';
  } else {
    homeHero?.classList.add('hidden');
    homeMain?.classList.add('hidden');
    spaView?.classList.remove('hidden');

    if (route === 'series') {
      await renderSeriesView(spaView);
    } else if (spaView) {
      spaView.innerHTML = renderPlaceholderView(route);
    }
  }

  setActiveNav(route);
  initImageFallbacks();
};

const initApp = async () => {
  renderSiteShell();
  applyTheme(localStorage.getItem('mp-theme') ?? 'dark');
  setupThemeToggle();
  initImageFallbacks();
  await renderRoute();
  window.addEventListener('hashchange', () => {
    void renderRoute();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initApp();
  }, { once: true });
} else {
  void initApp();
}
