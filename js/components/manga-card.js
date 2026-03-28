const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

const MAGAZINE_LABELS = {
  'wsj':          'WSJ',
  'sj-plus':      'SJ+',
  'morning':      'Morning',
  'young-animal': 'Young Animal',
};

/**
 * Creates an <a> element representing a manga series card.
 * @param {object} series - item from data/series.json
 * @returns {HTMLAnchorElement}
 */
export function createMangaCard({ id, title, poster, magazine_slug, score, chapter, status, next_chapter_date }) {
  const a = document.createElement('a');
  a.className = 'manga-card';
  a.href = `#/series/${id}`;

  a.innerHTML = `
    <img class="manga-cover" src="${poster}" alt="${esc(title)}" loading="lazy">
    <div class="manga-body">
      <div class="manga-title">${esc(title)}</div>
      <div class="manga-meta">
        <span>${MAGAZINE_LABELS[magazine_slug] ?? magazine_slug}</span>
        <span class="manga-score">★ ${score.toFixed(2)}</span>
      </div>
      <div class="manga-ch ${status}">${chapterLabel(status, chapter, next_chapter_date)}</div>
    </div>
  `;

  return a;
}

// ── Helpers ──────────────────────────────────────────
function chapterLabel(status, chapter, date) {
  if (status === 'done')   return `Завершено · Гл. ${chapter}`;
  if (status === 'hiatus') return `Хіатус · Гл. ${chapter}`;
  return `Гл. ${chapter} · ${formatDate(date)}`;
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'today') return 'Сьогодні';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  d.setHours(0, 0, 0, 0);
  return d.getTime() === TODAY
    ? 'Сьогодні'
    : d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (str) => str.replace(/[&<>"']/g, c => ESC_MAP[c]);