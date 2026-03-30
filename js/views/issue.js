import {
  LEGACY_FORMAT_LABELS,
  PUBLISHER_META,
  esc,
  formatUkDate,
  getPeriodicityMeta,
  parseIssueDate,
} from '../helpers.js';
import { icon } from '../icons.js';

// ─── Кеші ────────────────────────────────────────────────────────────────────

const requestCache = {};
const seriesCache  = new Map();

const cachedFetch = url => (requestCache[url] ??= fetch(url).then(r => {
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  return r.json();
}));

// ─── Константи ───────────────────────────────────────────────────────────────

const BADGE_META = {
  lead:  { label: 'lead/color',  className: 'badge-lead'  },
  color: { label: 'color', className: 'badge-color' },
  deb:   { label: 'debut', className: 'badge-deb'   },
  fin:   { label: 'final', className: 'badge-fin'   },
};

const SPECIAL_TYPE_LABELS = {
  oneshot:  'Ваншот',
  one_shot: 'Ваншот',
  special:  'Спецвипуск',
  extra:    'Екстра',
  pilot:    'Пілот',
};

// ─── Головна функція ──────────────────────────────────────────────────────────

export async function renderIssue(container, { slug, issue: issueParam }) {
  container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Завантаження…</p></div>`;

  try {
    const [magazines, oneshots] = await Promise.all([
      cachedFetch('./data/magazines.json'),
      cachedFetch('./data/oneshots.json'),
    ]);

    const magEntry = magazines.find(m => m.slug === slug);
    if (!magEntry) {
      container.innerHTML = `<div class="container page-body"><p>Журнал не знайдено.</p></div>`;
      return;
    }

    const magFile = await loadMagFile(magEntry);
    const issue   = findIssue(magFile?.issues ?? [], issueParam);

    if (!magFile || !issue) {
      container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Випуск не знайдено.</p></div>`;
      return;
    }

    const series    = await resolveIssueSeries(issue, slug, oneshots);
    const publisher = PUBLISHER_META[magFile.publisher ?? magEntry.publisher]
      ?? { label: magEntry.publisher, color: '#5b8dee' };

    container.innerHTML = renderHTML({ magFile, magEntry, publisher, issue, series });

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Не вдалося завантажити випуск.</p></div>`;
  }
}

// ─── Завантаження ─────────────────────────────────────────────────────────────

async function loadMagFile(magEntry) {
  try {
    return await Promise.any([
      cachedFetch(`./data/magazines/${magEntry.label}.json`),
      cachedFetch(`./data/magazines/${String(magEntry.slug).toUpperCase()}.json`),
    ]);
  } catch {
    return null;
  }
}

async function loadSeriesDetail(key, slug) {
  const normalizedKey = toKey(key);
  const cacheKey      = `${slug}:${normalizedKey}`;

  if (seriesCache.has(cacheKey)) return seriesCache.get(cacheKey);

  try {
    const detail = await cachedFetch(`./data/series/${normalizedKey}.json`);
    seriesCache.set(cacheKey, detail);
    return detail;
  } catch {
    seriesCache.set(cacheKey, null);
    return null;
  }
}

// ─── Пошук випуску ────────────────────────────────────────────────────────────

function findIssue(issues, rawParam) {
  if (!issues.length) return null;

  const [yearPart, ...rest] = String(rawParam ?? '').split('-');
  const parsedYear = Number(yearPart);
  const hasYear    = Number.isInteger(parsedYear) && parsedYear > 0;
  const number     = toKey(rest.join('-'));
  const rawKey     = toKey(rawParam);

  return issues.find(entry => {
    const entryYear   = parseIssueDate(entry.release_date)?.getFullYear();
    const entryNumber = toKey(entry.number);

    return number
      ? entryNumber === number && (!hasYear || entryYear === parsedYear)
      : entryNumber === rawKey;
  }) ?? null;
}

// ─── Побудова списку серій ────────────────────────────────────────────────────

async function resolveIssueSeries(issue, slug, oneshots) {
  const badgeSets = {
    lead:  new Set((issue.lead ?? []).map(toKey)),
    color: new Set((issue.color ?? []).map(toKey)),
    deb:   new Set((issue.deb_fin?.deb ?? []).map(toKey)),
    fin:   new Set((issue.deb_fin?.fin ?? []).map(toKey)),
  };

  const items = await Promise.all(
    (issue.series ?? []).map(malId => resolveSeriesEntry(malId, issue, slug, badgeSets)),
  );

  return mergeOneshots(items, issue, oneshots, badgeSets);
}

// Формуємо запис плитки серії
async function resolveSeriesEntry(malId, issue, slug, badgeSets) {
  const detail       = await loadSeriesDetail(malId, slug); // дані серії
  const chapterMatch = findChapterByDate(detail?.chapters, issue.release_date); // розділ за датою
  const chapterPages = chapterMatch?.chapter?.pages ? Number(chapterMatch.chapter.pages) : null; // сторінки

  return {
    kind:          'series',
    key:           toKey(malId),
    href:          buildSeriesHref(detail),
    title:         detail?.title ?? `Серія ${malId}`,
    poster:        detail?.poster ?? '',
    banner:        detail?.banner ?? '',
    chapterTitle:  chapterMatch?.chapter?.name ?? fallbackChapterTitle(detail),
    chapterNumber: chapterMatch
      ? resolveChapterNumber(detail, chapterMatch.index)
      : fallbackChapterNumber(detail),
    pages:         chapterPages,
    badges:        resolveBadges(malId, badgeSets),
  };
}

function mergeOneshots(items, issue, oneshots, badgeSets) {
  const result = [...items];
  const byId   = new Map(
    oneshots
      .filter(item => toKey(item?.mal_id))
      .map(item => [toKey(item.mal_id), item]),
  );

  for (const { malId, order } of parseOneshotPlacements(issue.oneshots)) {
    const oneshot = byId.get(malId);
    if (!oneshot) continue;

    const typeLabel = specialTypeLabel(oneshot.type);
    const insertAt  = Math.max(0, Math.min(result.length, order - 1));

    result.splice(insertAt, 0, {
      kind:          'oneshot',
      key:           malId,
      href:          '',
      title:         oneshot.title ?? `One-shot ${malId}`,
      poster:        oneshot.poster ?? '',
      banner:        oneshot.banner ?? '',
      chapterTitle:  typeLabel,
      chapterNumber: null,
      pages:         null,
      specialType:   typeLabel,
      badges:        resolveBadges(malId, badgeSets),
    });
  }

  return result;
}

function parseOneshotPlacements(raw = []) {
  const pairs = [];

  for (let i = 0; i < raw.length; i += 2) {
    const malId = toKey(raw[i]);
    const order = Number(raw[i + 1]);
    if (malId && Number.isFinite(order)) pairs.push({ malId, order });
  }

  return pairs.sort((a, b) => a.order - b.order);
}

// ─── Хелпери для глав ─────────────────────────────────────────────────────────

function findChapterByDate(chapters = [], releaseDate) {
  const key = toDateKey(releaseDate);
  if (!key || !Array.isArray(chapters)) return null;

  const index = chapters.findIndex(ch => toDateKey(ch.release_date) === key);
  return index === -1 ? null : { index, chapter: chapters[index] };
}

function toDateKey(value) {
  const raw = String(value ?? '').trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const date = parseIssueDate(value);
  if (!date) return '';

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function resolveChapterNumber(series, index) {
  const startsAtZero = [
    series?.chapters_starts_at_zero,
    series?.chapters_start_from_zero,
    series?.chapter_start_from_zero,
    series?.starts_from_zero,
  ].some(Boolean);

  return startsAtZero ? index : index + 1;
}

function fallbackChapterNumber(series) {
  for (const field of ['chapter', 'chapters']) {
    const n = Number(series?.[field]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function buildSeriesHref(detail) {
  if (!detail) return '';
  const id = detail.mal_id ?? detail.hikka_slug;
  return id ? `#/series/${id}` : '';
}

function fallbackChapterTitle(detail) {
  if (!detail) return 'Дані розділу ще не додані';
  const altTitle = String(detail.title_ua ?? '').trim();
  return altTitle && altTitle !== String(detail.title ?? '').trim()
    ? altTitle
    : 'Дані розділу ще не додані';
}

// ─── Бейджі ───────────────────────────────────────────────────────────────────

function resolveBadges(key, { lead, color, deb, fin }) {
  const k = toKey(key);
  return [
    deb.has(k)   && 'deb',
    fin.has(k)   && 'fin',
    lead.has(k)  && 'lead',
    color.has(k) && 'color',
  ].filter(Boolean);
}

const badgeMeta = badge => BADGE_META[badge] ?? { label: badge, className: 'badge-color' };

// ─── Рендер HTML ──────────────────────────────────────────────────────────────

function renderHTML({ magFile, magEntry, publisher, issue, series }) {
  const releaseDate = parseIssueDate(issue.release_date);
  const format      = magFile.format ?? magEntry.format;
  const period      = getPeriodicityMeta(format);
  const totalPages  = series.reduce((sum, s) => sum + (s.pages ?? 0), 0);
  const leadCount   = series.filter(s => s.badges.includes('lead')).length;
  const colorCount  = series.filter(s => s.badges.includes('color')).length;
  const rows        = series.map((s, i) => renderSeriesRow(s, i + 1)).join('');

  const formatLabel = period?.label ?? LEGACY_FORMAT_LABELS[magEntry.format] ?? String(format);
  const dateLabel   = releaseDate
    ? formatUkDate(releaseDate, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
    : 'Невідомо';

  return `
    <div class="container page-body">
      <a class="back-btn" href="#/magazines/${esc(magEntry.slug)}">← Назад до журналу</a>

      <div class="issue-hero">
        <div class="issue-cover">
          ${issue.poster
            ? `<img class="issue-cover-image" src="${esc(issue.poster)}" alt="${esc(`Випуск ${issue.number}`)}" loading="lazy">`
            : `<div class="issue-cover-inner">
                <div class="issue-cover-num">#${esc(issue.number)}</div>
                <div class="issue-cover-year">${releaseDate?.getFullYear() ?? '—'}</div>
              </div>`}
        </div>

        <div class="issue-info">
          <div class="issue-mag-lbl">${esc(magFile.title ?? magEntry.title)}</div>
          <div class="issue-title">Випуск #${esc(issue.number)}</div>
          <div class="issue-date">Дата виходу: <strong>${esc(dateLabel)}</strong></div>

          <div class="issue-stats">
            ${renderStat(series.length, 'Серій')}
            ${renderStat(totalPages || '—', 'Сторінок')}
            ${renderStat(leadCount, 'Lead')}
            ${renderStat(colorCount, 'Color')}
          </div>

          <div class="issue-info-chips">
            <span class="chip ${period?.chipClass ?? 'chip-weekly'}">${esc(formatLabel)}</span>
            <span class="mag-chip">${esc(publisher.label)}</span>
            <span class="chip chip-ongoing">Вийшов</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">${icon('three-line')} Серії в номері</h2>
        </div>
        <div class="issue-list">
          ${rows || `<p style="color:var(--text-muted);padding:20px 0">Для цього випуску ще немає серій.</p>`}
        </div>
      </div>
    </div>
  `;
}

const renderStat = (val, label) => `
  <div class="issue-stat">
    <div class="issue-stat-val">${val}</div>
    <div class="issue-stat-lbl">${label}</div>
  </div>`;

function renderSeriesRow(series, position) {
  const badges = series.badges
    .map(b => {
      const { label, className } = badgeMeta(b);
      return `<span class="issue-series-badge ${className}">${label}</span>`;
    })
    .join('');

  const thumb = series.poster
    ? `<img class="issue-thumb" src="${esc(series.poster)}" alt="${esc(series.title)}" loading="lazy">`
    : `<div class="issue-thumb issue-thumb-placeholder">?</div>`;

  const chLabel = series.kind === 'oneshot'
    ? esc(series.specialType ?? 'Спецвипуск')
    : series.chapterNumber !== null ? `Розд. ${series.chapterNumber}` : 'Розділ невідомий';

  return `
    <a class="issue-row${series.banner ? ' has-banner' : ''}" href="${series.href || '#'}" data-mal-id="${esc(series.key)}" data-kind="${esc(series.kind)}" ${bannerStyle(series.banner)}>
      <div class="issue-pos">
        ${position}
        ${badges ? `<div class="issue-series-badges">${badges}</div>` : ''}
      </div>
      ${thumb}
      <div class="issue-series-info">
        <div class="issue-series-title">${esc(series.title)}</div>
        <div class="issue-series-sub">${esc(series.chapterTitle)}</div>
      </div>
      <div class="issue-ch">${chLabel}</div>
      <div class="issue-pages">${series.pages ? `${series.pages} стор.` : '—'}</div>
    </a>
  `;
}

// ─── Утиліти ─────────────────────────────────────────────────────────────────

function bannerStyle(url) {
  const normalized = String(url ?? '').trim();
  if (!normalized) return '';

  const safeUrl = normalized
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\r\n]/g, '');

  return `style="--banner:url('${esc(safeUrl)}')"`;
}

const toKey = value => String(value ?? '').trim();

const specialTypeLabel = type => {
  const key = String(type ?? '').trim().toLowerCase();
  return SPECIAL_TYPE_LABELS[key] ?? (key ? String(type) : 'Спецвипуск');
};
