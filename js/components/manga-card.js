import { MAGAZINE_LABELS, esc } from '../helpers.js';

const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

/**
 * Creates an <a> element representing a manga series card.
 * @param {object} series - item from data/series.json
 * @returns {HTMLAnchorElement}
 */
export function createMangaCard({ id, mal_id, href, title, poster, magazine_slug, score, chapter, status, next_chapter_date }) {
  const routeId = id ?? mal_id ?? '';
  const a = document.createElement('a');
  a.className = 'manga-card';
  a.href = href ?? `#/series/${routeId}`;

  const scoreHTML = Number.isFinite(score)
    ? `<span class="manga-score">★ ${score.toFixed(2)}</span>`
    : '';
  const coverHTML = poster
    ? `<img class="manga-cover" src="${poster}" alt="${esc(title)}" loading="lazy">`
    : `<div class="manga-cover manga-cover-placeholder">?</div>`;

  a.innerHTML = `
    ${coverHTML}
    <div class="manga-body">
      <div class="manga-title">${esc(title)}</div>
      <div class="manga-meta">
        <span>${MAGAZINE_LABELS[magazine_slug] ?? magazine_slug}</span>
        ${scoreHTML}
      </div>
      <div class="manga-ch ${status}">${chapterLabel(status, chapter, next_chapter_date)}</div>
    </div>
  `;

  return a;
}

function chapterLabel(status, chapter, date) {
  if (status === 'done')   return chapter ? `Завершено · Гл. ${chapter}` : 'Завершено';
  if (status === 'hiatus') return chapter ? `Хіатус · Гл. ${chapter}` : 'Хіатус';
  if (!chapter) return 'Онгоінг';
  return `Гл. ${chapter} · ${formatDate(date)}`;
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'today') return 'Сьогодні';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === TODAY
    ? 'Сьогодні'
    : d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}
