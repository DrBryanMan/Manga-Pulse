import { esc, formatUkDate, parseIssueDate } from '../helpers.js';

export function createIssueCard({ slug, issue, isCurrent = false }) {
  const releaseDate = parseIssueDate(issue.release_date);
  const href = releaseDate
    ? `#/magazines/${esc(slug)}/${releaseDate.getFullYear()}-${esc(issue.number)}`
    : '#';
  const seriesCount = issue.series?.length ?? 0;
  const cover = issue.poster
    ? `<img class="issue-card-cover" src="${esc(issue.poster)}" alt="${esc(`Випуск ${issue.number}`)}" loading="lazy">`
    : `<div class="issue-card-cover issue-card-cover-placeholder">#${esc(issue.number)}</div>`;

  const article = document.createElement('a');
  article.className = `issue-card${isCurrent ? ' current' : ''}`;
  article.href = href;

  article.innerHTML = `
    ${cover}
    <div class="issue-card-body">
      <div class="issue-card-topline">
        <div class="issue-card-number">#${esc(issue.number)}</div>
        ${isCurrent ? '<span class="chip chip-new">Поточний</span>' : ''}
      </div>
      <div class="issue-card-date">${esc(releaseDate ? formatUkDate(releaseDate, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Дата невідома')}</div>
      <div class="issue-card-meta">
        <span>${seriesCount} серій</span>
      </div>
    </div>
  `;

  return article;
}
