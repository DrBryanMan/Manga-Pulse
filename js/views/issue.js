import {
  LEGACY_FORMAT_LABELS,
  PUBLISHER_META,
  esc,
  formatUkDate,
  getPeriodicityMeta,
  parseIssueDate,
} from '../helpers.js';
import { icon } from '../icons.js';

const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(response => {
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}));

const seriesDetailsCache = new Map();

export async function renderIssue(container, { slug, issue }) {
  container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Завантаження…</p></div>`;

  try {
    const [magazines, oneshots] = await Promise.all([
      fetchOnce('./data/magazines.json'),
      fetchOnce('./data/oneshots.json'),
    ]);

    const mag = magazines.find(item => item.slug === slug);
    if (!mag) {
      container.innerHTML = `<div class="container page-body"><p>Журнал не знайдено.</p></div>`;
      return;
    }

    const magazineFile = await fetchMagazineFile(mag);
    const issueTarget  = resolveIssueFromParam(magazineFile?.issues ?? [], issue);
    if (!magazineFile || !issueTarget) {
      container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Випуск не знайдено.</p></div>`;
      return;
    }

    const issueSeries = await buildIssueSeries(issueTarget, slug, oneshots);
    const pub         = PUBLISHER_META[magazineFile.publisher ?? mag.publisher] ?? { label: mag.publisher, color: '#5b8dee' };

    container.innerHTML = buildHTML({
      mag: magazineFile,
      fallbackMag: mag,
      pub,
      issue: issueTarget,
      series: issueSeries,
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Не вдалося завантажити випуск.</p></div>`;
  }
}

async function fetchMagazineFile(mag) {
  const candidates = [
    `./data/magazines/${mag.label}.json`,
    `./data/magazines/${String(mag.slug).toUpperCase()}.json`,
  ];

  for (const url of candidates) {
    try {
      return await fetchOnce(url);
    } catch {
      continue;
    }
  }

  return null;
}

function resolveIssueFromParam(issues, rawIssue) {
  if (!issues.length) return null;

  const [yearPart, ...numberParts] = String(rawIssue ?? '').split('-');
  const parsedYear = Number(yearPart);
  const hasYear    = Number.isInteger(parsedYear) && parsedYear > 0;
  const number     = normalizeKey(numberParts.join('-'));
  const rawValue   = normalizeKey(rawIssue);

  return issues.find(entry => {
    const releaseDate = parseIssueDate(entry.release_date);
    const entryYear   = releaseDate?.getFullYear();
    const entryNumber = normalizeKey(entry.number);

    if (number) {
      return entryNumber === number && (!hasYear || entryYear === parsedYear);
    }

    return entryNumber === rawValue;
  }) ?? null;
}

async function buildIssueSeries(issue, slug, oneshots) {
  const leadSet     = new Set((issue.lead ?? []).map(normalizeKey));
  const colorSet    = new Set((issue.color ?? []).map(normalizeKey));
  const debSet      = new Set((issue.deb_fin?.deb ?? []).map(normalizeKey));
  const finSet      = new Set((issue.deb_fin?.fin ?? []).map(normalizeKey));
  const seriesItems = await Promise.all(
    (issue.series ?? []).map(seriesMalId => buildSeriesEntry(seriesMalId, issue, slug, leadSet, colorSet, debSet, finSet)),
  );

  return insertOneshots(seriesItems, issue, oneshots, leadSet, colorSet, debSet, finSet);
}

async function buildSeriesEntry(seriesMalId, issue, slug, leadSet, colorSet, debSet, finSet) {
  const detail       = await findSeriesDetail(seriesMalId, slug);
  const chapterMatch = matchChapterByDate(detail?.chapters, issue.release_date);
  const chapterTitle = chapterMatch?.chapter?.name ?? getSecondarySeriesLabel(detail);
  const chapterPages = chapterMatch?.chapter?.pages ? Number(chapterMatch.chapter.pages) : null;

  return {
    kind:          'series',
    key:           normalizeKey(seriesMalId),
    href:          getSeriesHref(detail),
    title:         detail?.title ?? `Серія ${seriesMalId}`,
    poster:        detail?.poster ?? '',
    chapterTitle,
    chapterNumber: chapterMatch
      ? getChapterNumber(detail, chapterMatch.index)
      : getSeriesChapterNumber(detail),
    pages:         chapterPages,
    badges:        getIssueBadges(seriesMalId, leadSet, colorSet, debSet, finSet),
  };
}

function insertOneshots(seriesItems, issue, oneshots, leadSet, colorSet, debSet, finSet) {
  const result      = [...seriesItems];
  const placements  = parseOneshotPlacements(issue.oneshots);
  const oneshotById = new Map(
    oneshots
      .filter(item => normalizeKey(item?.mal_id))
      .map(item => [normalizeKey(item.mal_id), item]),
  );

  for (const placement of placements) {
    const oneshot = oneshotById.get(placement.malId);
    if (!oneshot) continue;

    const targetIndex = Math.max(0, Math.min(result.length, placement.order - 1));
    result.splice(targetIndex, 0, {
      kind:          'oneshot',
      key:           placement.malId,
      href:          '',
      title:         oneshot.title ?? `One-shot ${placement.malId}`,
      poster:        oneshot.poster ?? '',
      chapterTitle:  getSpecialTypeLabel(oneshot.type),
      chapterNumber: null,
      pages:         null,
      specialType:   getSpecialTypeLabel(oneshot.type),
      badges:        getIssueBadges(placement.malId, leadSet, colorSet, debSet, finSet),
    });
  }

  return result;
}

function parseOneshotPlacements(rawPlacements = []) {
  const placements = [];

  for (let index = 0; index < rawPlacements.length; index += 2) {
    const malId = normalizeKey(rawPlacements[index]);
    const order = Number(rawPlacements[index + 1]);
    if (!malId || !Number.isFinite(order)) continue;
    placements.push({ malId, order });
  }

  return placements.sort((a, b) => a.order - b.order);
}

async function findSeriesDetail(seriesKey, slug) {
  const normalizedKey = normalizeKey(seriesKey);
  const cacheKey      = `${slug}:${normalizedKey}`;
  if (seriesDetailsCache.has(cacheKey)) {
    return seriesDetailsCache.get(cacheKey);
  }

  try {
    const detail = await fetchOnce(`./data/series/${normalizedKey}.json`);
    seriesDetailsCache.set(cacheKey, detail);
    return detail;
  } catch {
    seriesDetailsCache.set(cacheKey, null);
    return null;
  }
}

function matchChapterByDate(chapters = [], releaseDate) {
  const issueDate = parseIssueDate(releaseDate);
  if (!issueDate || !Array.isArray(chapters)) return null;

  const index = chapters.findIndex(chapter => {
    const chapterDate = parseIssueDate(chapter.release_date);
    return chapterDate && chapterDate.getTime() === issueDate.getTime();
  });

  if (index === -1) return null;
  return { index, chapter: chapters[index] };
}

function getChapterNumber(series, index) {
  const startsAtZero = [
    series?.chapters_starts_at_zero,
    series?.chapters_start_from_zero,
    series?.chapter_start_from_zero,
    series?.starts_from_zero,
  ].some(Boolean);

  return startsAtZero ? index : index + 1;
}

function getSeriesChapterNumber(series) {
  const chapter = Number(series?.chapter);
  if (Number.isFinite(chapter) && chapter > 0) return chapter;

  const chapters = Number(series?.chapters);
  if (Number.isFinite(chapters) && chapters > 0) return chapters;

  return null;
}

function getSeriesHref(detail) {
  if (!detail) return '';
  return detail.hikka_slug
    ? `#/series/${detail.hikka_slug}`
    : (detail.mal_id ? `#/series/${detail.mal_id}` : '');
}

function getSecondarySeriesLabel(detail) {
  if (!detail) return 'Дані розділу ще не додані';

  const altTitle = String(detail.title_ua ?? '').trim();
  if (altTitle && altTitle !== String(detail.title ?? '').trim()) {
    return altTitle;
  }

  return 'Дані розділу ще не додані';
}

function buildHTML({ mag, fallbackMag, pub, issue, series }) {
  const releaseDate  = parseIssueDate(issue.release_date);
  const period       = getPeriodicityMeta(mag.format ?? fallbackMag.format);
  const totalPages   = series.reduce((sum, item) => sum + (item.pages ?? 0), 0);
  const leadCount    = series.filter(item => item.badges.includes('lead')).length;
  const colorCount   = series.filter(item => item.badges.includes('color')).length;
  const seriesRows   = series.map((item, index) => buildSeriesRow(item, index + 1)).join('');

  return `
    <div class="container page-body">
      <a class="back-btn" href="#/magazines/${esc(fallbackMag.slug)}">← Назад до журналу</a>

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
          <div class="issue-mag-lbl">${esc(mag.title ?? fallbackMag.title)}</div>
          <div class="issue-title">Випуск #${esc(issue.number)}</div>
          <div class="issue-date">Дата виходу: <strong>${esc(releaseDate ? formatUkDate(releaseDate, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) : 'Невідомо')}</strong></div>

          <div class="issue-stats">
            <div class="issue-stat">
              <div class="issue-stat-val">${series.length}</div>
              <div class="issue-stat-lbl">Серій</div>
            </div>
            <div class="issue-stat">
              <div class="issue-stat-val">${totalPages || '—'}</div>
              <div class="issue-stat-lbl">Сторінок</div>
            </div>
            <div class="issue-stat">
              <div class="issue-stat-val">${leadCount}</div>
              <div class="issue-stat-lbl">Lead</div>
            </div>
            <div class="issue-stat">
              <div class="issue-stat-val">${colorCount}</div>
              <div class="issue-stat-lbl">Color</div>
            </div>
          </div>

          <div class="issue-info-chips">
            <span class="chip ${period?.chipClass ?? 'chip-weekly'}">${esc(period?.label ?? LEGACY_FORMAT_LABELS[fallbackMag.format] ?? String(mag.format ?? fallbackMag.format))}</span>
            <span class="mag-chip">${esc(pub.label)}</span>
            <span class="chip chip-ongoing">Вийшов</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">${icon('three-line')} Серії в номері</h2>
        </div>

        <div class="issue-list">
          ${seriesRows || `<p style="color:var(--text-muted);padding:20px 0">Для цього випуску ще немає серій.</p>`}
        </div>
      </div>
    </div>
  `;
}

function getIssueBadges(seriesKey, leadSet, colorSet, debSet, finSet) {
  const normalizedKey = normalizeKey(seriesKey);
  const badges = [];

  if (debSet.has(normalizedKey))   badges.push('deb');
  if (finSet.has(normalizedKey))   badges.push('fin');
  if (leadSet.has(normalizedKey))  badges.push('lead');
  if (colorSet.has(normalizedKey)) badges.push('color');

  return badges;
}

function buildSeriesRow(series, position) {
  const badges = series.badges.map(badge => {
    const meta = getBadgeMeta(badge);
    return `<span class="chip issue-series-badge ${meta.className}">${meta.label}</span>`;
  }).join('');

  const thumb = series.poster
    ? `<img class="issue-thumb" src="${esc(series.poster)}" alt="${esc(series.title)}" loading="lazy">`
    : `<div class="issue-thumb issue-thumb-placeholder">?</div>`;

  const href = series.href || '#';

  return `
    <a class="issue-row" href="${href}" data-mal-id="${esc(series.key)}" data-kind="${esc(series.kind)}">
      <div class="issue-pos">${position}</div>
      ${thumb}
      <div class="issue-series-info">
        <div class="issue-series-title">${esc(series.title)}</div>
        <div class="issue-series-sub">${esc(series.chapterTitle)}</div>
        ${badges ? `<div class="issue-series-badges">${badges}</div>` : ''}
      </div>
      <div class="issue-ch">${series.kind === 'oneshot' ? esc(series.specialType ?? 'Спецвипуск') : (series.chapterNumber !== null ? `Розд. ${series.chapterNumber}` : 'Розділ невідомий')}</div>
      <div class="issue-pages">${series.pages ? `${series.pages} стор.` : '—'}</div>
    </a>
  `;
}

function getBadgeMeta(badge) {
  const badgeMap = {
    lead:  { label: 'Lead',  className: 'issue-series-badge-lead' },
    color: { label: 'Color', className: 'issue-series-badge-color' },
    deb:   { label: 'Debut', className: 'issue-series-badge-deb' },
    fin:   { label: 'Final', className: 'issue-series-badge-fin' },
  };

  return badgeMap[badge] ?? { label: badge, className: 'issue-series-badge-color' };
}

function normalizeKey(value) {
  return String(value ?? '').trim();
}

function getSpecialTypeLabel(type) {
  const normalized = String(type ?? '').trim().toLowerCase();
  if (!normalized) return 'Спецвипуск';

  const labels = {
    oneshot:  'Ваншот',
    one_shot: 'Ваншот',
    special:  'Спецвипуск',
    extra:    'Екстра',
    pilot:    'Пілот',
  };

  return labels[normalized] ?? String(type);
}
