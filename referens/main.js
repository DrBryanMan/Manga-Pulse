/* ═══════════════════════════════════════════════════════
   MangaCal — main.js
   Спільна логіка для всіх сторінок
═══════════════════════════════════════════════════════ */

'use strict';

// ── Theme ─────────────────────────────────────────────
const applyTheme = theme => {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('mc-theme', theme);
};

const toggleTheme = () =>
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

// Відновлення теми при завантаженні
applyTheme(localStorage.getItem('mc-theme') ?? 'dark');

// ── Active nav ────────────────────────────────────────
const activePage = document.body.dataset.page;
document.querySelectorAll('.nav-link[data-nav]').forEach(link => {
  link.classList.toggle('active', link.dataset.nav === activePage);
});

// ── Filter chips / buttons (single-select per row) ────
document.querySelectorAll('.filter-row, .filter-chips').forEach(row => {
  row.addEventListener('click', ({ target }) => {
    const btn = target.closest('.filter-btn, .filter-chip');
    if (!btn) return;
    row.querySelectorAll('.filter-btn, .filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Tabs ──────────────────────────────────────────────
const switchTab = (btn, panelId) => {
  const tabs = btn.closest('.tabs');
  tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  tabs.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${panelId}`)?.classList.add('active');
};

// ── Calendar view toggle (month / week) ───────────────
const switchCalView = view => {
  document.getElementById('cal-month-view')?.classList.toggle('hidden', view !== 'month');
  document.getElementById('cal-week-view')?.classList.toggle('hidden', view !== 'week');
  document.querySelectorAll('.cal-view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view)
  );
};

// ── Image error fallback → gradient placeholder ───────
const coverColors = {
  onepiece:    'linear-gradient(160deg,#1a2a3a,#0d1117)',
  chainsaw:    'linear-gradient(160deg,#2a1a1a,#160a0a)',
  jujutsu:     'linear-gradient(160deg,#1a2a1a,#0a160a)',
  dandadan:    'linear-gradient(160deg,#2a2a1a,#16160a)',
  berserk:     'linear-gradient(160deg,#1a1a2a,#0a0a16)',
  vagabond:    'linear-gradient(160deg,#2a1f15,#160d08)',
  vinland:     'linear-gradient(160deg,#1f2a1a,#0d160a)',
  mha:         'linear-gradient(160deg,#2a1a1a,#1c0d0d)',
  spy:         'linear-gradient(160deg,#1a2030,#0d1520)',
  kaiju:       'linear-gradient(160deg,#201a2a,#100a1a)',
};

document.querySelectorAll('img[data-key]').forEach(img => {
  img.addEventListener('error', () => {
    const ph = document.createElement('div');
    ph.className = img.className;
    ph.style.background = coverColors[img.dataset.key] ?? 'linear-gradient(135deg,#161d2a,#0b0f14)';
    img.replaceWith(ph);
  });
});
