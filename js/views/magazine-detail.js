import { createMangaCard } from '../components/manga-card.js';
import { createIssueCard } from '../components/issue-card.js';
import {
  DEMOGRAPHIC_LABELS,
  LEGACY_FORMAT_LABELS,
  PUBLISHER_META,
  esc,
  formatUkDate,
  getNextIssueDate,
  getPeriodicityMeta,
  parseIssueDate,
} from '../helpers.js';
import { icon } from '../icons.js'

const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(response => {
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}));

const seriesDetailsCache = new Map();

export async function renderMagazineDetail(container, { slug, subpage = '' }) {
  container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Завантаження…</p></div>`;

  try {
    const [magazines, legacySeries, magazineAnalytics] = await Promise.all([
      fetchOnce('./data/magazines.json'),
      fetchOnce('./data/series.json'),
      fetchOnce('./data/magazines/analytics.json'),
    ]);

    const mag = magazines.find(item => item.slug === slug);
    if (!mag) {
      container.innerHTML = `<div class="container page-body"><p>Журнал не знайдено.</p></div>`;
      return;
    }

    const detailedMagazine = await fetchMagazineFile(mag);
    const analytics        = magazineAnalytics[slug];
    const magazineData     = buildMagazineViewModel(mag, detailedMagazine, analytics, legacySeries);
    const allSeries        = analytics?.series?.length
      ? await buildMagazineSeries(legacySeries, magazineData, slug)
      : buildLegacySeries(legacySeries, slug);
    const activeSeries     = allSeries.filter(series => series.status === 'active');
    const selectedSubpage  = subpage === 'series' || subpage === 'issues' ? subpage : '';

    container.innerHTML = buildHTML({
      mag,
      magazineData,
      pub: PUBLISHER_META[mag.publisher] ?? { label: mag.publisher, color: '#5b8dee' },
      allSeries,
      activeSeries,
      subpage: selectedSubpage,
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Не вдалося завантажити журнал.</p></div>`;
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

function buildMagazineViewModel(mag, detailedMagazine, analytics = {}, legacySeries = []) {
  const issues         = (detailedMagazine?.issues ?? []).filter(issue => issue?.number);
  const issuesWithDate = issues.filter(issue => parseIssueDate(issue.release_date));
  const firstIssue     = issuesWithDate[0] ?? null;
  const lastIssue      = issuesWithDate.at(-1) ?? null;
  const periodicity    = getPeriodicityMeta(detailedMagazine?.format ?? mag.format);
  const nextIssueDate  = lastIssue ? getNextIssueDate(lastIssue.release_date, detailedMagazine?.format ?? mag.format, detailedMagazine?.breaks ?? []) : null;
  const fallbackSeries = legacySeries.filter(series => series.magazine_slug === mag.slug);
  const fallbackIssues = issues.length ? issues : generateFallbackIssues(mag);

  return {
    title:        detailedMagazine?.title ?? mag.title,
    title_ja:     detailedMagazine?.title_ja ?? mag.title_ja,
    label:        detailedMagazine?.label ?? mag.label,
    demographic:  detailedMagazine?.demographic ?? mag.demographic,
    format:       detailedMagazine?.format ?? mag.format,
    year:         firstIssue ? parseIssueDate(firstIssue.release_date)?.getFullYear() : mag.year,
    issuesCount:  fallbackIssues.length,
    issues:       fallbackIssues,
    seriesIds:    analytics.series ?? fallbackSeries.map(series => series.id),
    ongoingIds:   new Set(analytics.ongoings ?? []),
    nextIssue:    nextIssueDate ? `#${getNextIssueNumber(lastIssue?.number)} — ${formatUkDate(nextIssueDate, { day: 'numeric', month: 'long' })}` : (mag.next_issue ?? 'Невідомо'),
    nextLabel:    nextIssueDate ? 'Наступний номер' : (mag.next_label ?? 'Наступний номер'),
    periodicity,
  };
}

async function buildMagazineSeries(legacySeries, magazineData, slug) {
  const legacyBySlug = new Map(legacySeries.map(series => [series.id, series]));

  const result = await Promise.all(
    magazineData.seriesIds.map(async seriesKey => {
      const detail = await findSeriesDetail(seriesKey, legacySeries, slug);
      const legacy = detail?.legacyId ? legacyBySlug.get(detail.legacyId) : null;
      const latestIssueWithSeries = [...magazineData.issues]
        .reverse()
        .find(issue => issue.series?.includes(seriesKey) && parseIssueDate(issue.release_date));

      const status = magazineData.ongoingIds.has(seriesKey) ? 'active' : 'done';
      const latestChapter = detail?.chapters ?? legacy?.chapter ?? null;
      const latestChapterDate = status === 'active'
        ? detail?.next_chapter_date ?? legacy?.next_chapter_date ?? null
        : latestIssueWithSeries?.release_date ?? detail?.next_chapter_date ?? legacy?.next_chapter_date ?? null;

      return {
        key:               seriesKey,
        id:                detail?.legacyId ?? legacy?.id ?? '',
        href:              detail?.legacyId ?? legacy?.id ? `#/series/${detail?.legacyId ?? legacy?.id}` : '',
        title:             detail?.title ?? legacy?.title ?? `Серія ${seriesKey}`,
        title_ua:          detail?.title_ua ?? legacy?.title_ua ?? '',
        poster:            detail?.poster ?? legacy?.poster ?? '',
        magazine_slug:     legacy?.magazine_slug ?? 'wsj',
        score:             legacy?.score ?? null,
        chapter:           latestChapter,
        status,
        next_chapter_date: latestChapterDate,
      };
    }),
  );

  return result;
}

async function findSeriesDetail(seriesKey, legacySeries, slug) {
  const cacheKey = `${slug}:${seriesKey}`;
  if (seriesDetailsCache.has(cacheKey)) {
    return seriesDetailsCache.get(cacheKey);
  }

  const candidates = legacySeries
    .filter(series => series.magazine_slug === slug)
    .map(series => ({ legacyId: series.id, url: `./data/series/${series.id}-${seriesKey}.json` }));

  for (const candidate of candidates) {
    try {
      const detail = await fetchOnce(candidate.url);
      const resolved = { ...detail, legacyId: candidate.legacyId };
      seriesDetailsCache.set(cacheKey, resolved);
      return resolved;
    } catch {
      continue;
    }
  }

  seriesDetailsCache.set(cacheKey, null);
  return null;
}

function buildLegacySeries(legacySeries, slug) {
  return legacySeries
    .filter(series => series.magazine_slug === slug)
    .map(series => ({
      key:               series.id,
      id:                series.id,
      href:              `#/series/${series.id}`,
      title:             series.title,
      title_ua:          series.title_ua ?? '',
      poster:            series.poster ?? '',
      magazine_slug:     series.magazine_slug,
      score:             series.score ?? null,
      chapter:           series.chapter ?? null,
      status:            series.status ?? 'done',
      next_chapter_date: series.next_chapter_date ?? null,
    }));
}

function generateFallbackIssues(mag) {
  const periodicity = getPeriodicityMeta(mag.format);
  const baseDate    = new Date('2026-03-27');
  const count       = 5;

  return Array.from({ length: count }, (_, index) => {
    const offset = periodicity?.days ?? 7;
    const date   = new Date(baseDate);
    date.setTime(date.getTime() - index * offset * 24 * 60 * 60 * 1000);

    return {
      number:       String(Math.max(1, 16 - index)),
      release_date: date.toISOString().slice(0, 10),
      series:       [],
    };
  }).reverse();
}

function buildHTML({ mag, magazineData, pub, allSeries, activeSeries, subpage }) {
  if (subpage) {
    return buildSubpageHTML({ mag, allSeries, issues: [...magazineData.issues].reverse(), subpage });
  }

  const visibleIssues = [...magazineData.issues]
  // const visibleIssues = [...magazineData.issues].slice(-5).reverse();
  const issueTitle    = 'Останні випуски';
  const issueHint     = 'Останні додані випуски';
  const issueRows     = visibleIssues.reverse().map(issue => buildIssueRow(mag.slug, issue, magazineData.seriesIds.length, issue === visibleIssues[0])).join('');
  const seriesHTML    = buildSeriesGrid(activeSeries);

  return `
    <div class="container page-body">
      <a class="back-btn" href="#/magazines">← Назад до журналів</a>

      <div class="mag-detail-hero" style="--pub-color:${pub.color}">
        <div class="mag-detail-accent"></div>
        <div class="mag-detail-content">
          <div class="mag-detail-label">${esc(magazineData.label)}</div>
          <div class="mag-detail-title">${esc(magazineData.title)}</div>
          <div class="mag-detail-ja">${esc(magazineData.title_ja)}</div>
          <div class="mag-detail-badges">
            <span class="chip ${magazineData.periodicity?.chipClass ?? 'chip-weekly'}">${esc(magazineData.periodicity?.label ?? LEGACY_FORMAT_LABELS[magazineData.format] ?? String(magazineData.format))}</span>
            <span class="mag-badge" style="font-size:11px;font-weight:500;color:var(--text-2);padding:3px 8px;border:1px solid var(--border-s);border-radius:50px;background:var(--bg-2)">${esc(DEMOGRAPHIC_LABELS[magazineData.demographic] ?? magazineData.demographic)}</span>
            <span style="font-size:12px;color:${pub.color};font-weight:600">${esc(pub.label)}</span>
          </div>
          <div class="mag-detail-stats">
            <div class="mag-dstat">
              <span class="mag-dstat-val">${magazineData.seriesIds.length}</span>
              <span class="mag-dstat-lbl">Серій</span>
            </div>
            <div class="mag-dstat">
              <span class="mag-dstat-val">${magazineData.issuesCount}</span>
              <span class="mag-dstat-lbl">Випусків</span>
            </div>
            <div class="mag-dstat">
              <span class="mag-dstat-val">${esc(mag.circulation)}</span>
              <span class="mag-dstat-lbl">Тираж</span>
            </div>
            <div class="mag-dstat">
              <span class="mag-dstat-val">${magazineData.year ?? '—'}</span>
              <span class="mag-dstat-lbl">Перший рік</span>
            </div>
          </div>
          <div class="mag-detail-next">
            <span class="mag-next-lbl">${esc(magazineData.nextLabel)}</span>
            <span class="mag-next-date">${esc(magazineData.nextIssue)}</span>
          </div>
        </div>
      </div>

      <div class="mag-detail-grid">
        <div class="mag-detail-main">
          <div class="section">
            <div class="section-header">
              <div>
                <h2 class="section-title">${icon('three-line')} Поточні серії (${activeSeries.length})
                </h2>
              </div>
              <div class="section-actions">
                <a class="back-btn section-btn" href="#/magazines/${esc(mag.slug)}/series">Всі</a>
              </div>
            </div>
            ${seriesHTML}
          </div>
        </div>

        <aside class="mag-detail-aside">
          <div class="section">
            <div class="section-header">
              <div>
                <h2 class="section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  ${issueTitle}
                </h2>
                <div class="section-label">${issueHint}</div>
              </div>
              <div class="section-actions">
                <a class="back-btn section-btn" href="#/magazines/${esc(mag.slug)}/issues">Всі</a>
              </div>
            </div>
            <div class="mag-issues-list">${issueRows || `<p style="color:var(--text-muted);padding:20px 0">Випуски ще не додані.</p>`}</div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function buildSubpageHTML({ mag, allSeries, issues, subpage }) {
  const isSeriesPage = subpage === 'series';
  const title = isSeriesPage ? 'Серії у журналі' : 'Випуски журналу';
  const catalogHTML = isSeriesPage
    ? buildSeriesGrid(allSeries)
    : buildIssuesCatalog(mag.slug, issues);

  return `
    <div class="container page-body">
      <a class="back-btn" href="#/magazines/${esc(mag.slug)}">← Назад до журналу</a>

      <div class="mag-subpage-head">
        <div>
          <h1 class="page-title">${title}</h1>
          <div class="section-label">${esc(mag.title)}</div>
        </div>
        <div class="mag-subpage-switch">
          <a class="back-btn section-btn${isSeriesPage ? ' active' : ''}" href="#/magazines/${esc(mag.slug)}/series">Серії</a>
          <a class="back-btn section-btn${!isSeriesPage ? ' active' : ''}" href="#/magazines/${esc(mag.slug)}/issues">Випуски</a>
        </div>
      </div>

      ${catalogHTML}
    </div>
  `;
}

function buildSeriesGrid(series) {
  if (!series.length) {
    return `<p style="color:var(--text-muted);padding:20px 0">Серій для цього режиму поки немає.</p>`;
  }

  const cards = series.map(item => {
    if (!item.poster || !item.href) {
      return `
        <article class="manga-card manga-card-placeholder">
          <div class="manga-cover manga-cover-placeholder">?</div>
          <div class="manga-body">
            <div class="manga-title">${esc(item.title)}</div>
            <div class="manga-meta">
              <span>${esc(item.key)}</span>
              <span class="chip ${item.status === 'active' ? 'chip-ongoing' : 'chip-done'}">${item.status === 'active' ? 'Онгоінг' : 'Завершено'}</span>
            </div>
            <div class="manga-ch ${item.status}">${buildSeriesFooter(item)}</div>
          </div>
        </article>
      `;
    }

    return createMangaCard({
      id:                item.id,
      href:              item.href,
      title:             item.title,
      poster:            item.poster,
      magazine_slug:     item.magazine_slug,
      score:             item.score,
      chapter:           item.chapter,
      status:            item.status,
      next_chapter_date: item.next_chapter_date,
    }).outerHTML;
  }).join('');

  return `<div class="manga-grid">${cards}</div>`;
}

function buildIssuesCatalog(slug, issues) {
  if (!issues.length) {
    return `<p style="color:var(--text-muted);padding:20px 0">Випуски ще не додані.</p>`;
  }

  const cards = issues.map((issue, index) =>
    createIssueCard({
      slug,
      issue,
      isCurrent: index === 0,
    }).outerHTML,
  ).join('');

  return `<div class="issue-card-grid">${cards}</div>`;
}

function buildSeriesFooter(series) {
  if (series.chapter && series.next_chapter_date) {
    const prefix = series.status === 'active' ? 'Розд.' : 'Останній розд.';
    return `${prefix} ${series.chapter} · ${formatUkDate(series.next_chapter_date, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  if (series.chapter) {
    return `${series.status === 'active' ? 'Розд.' : 'Останній розд.'} ${series.chapter}`;
  }

  return 'Деталі серії ще не додані';
}

function buildIssueRow(slug, issue, seriesCount, isCurrent) {
  const issueDate = parseIssueDate(issue.release_date);
  const issueHref = issueDate ? `#/magazines/${esc(slug)}/${issueDate.getFullYear()}-${esc(issue.number)}` : '#';

  return `
    <a class="mag-issue-row${isCurrent ? ' current' : ''}" href="${issueHref}">
      <div class="mag-issue-num">#${esc(issue.number)}</div>
      <div class="mag-issue-date">${esc(issueDate ? formatUkDate(issueDate, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Дата невідома')}</div>
      <div class="mag-issue-series">${issue.series?.length ?? seriesCount} серій</div>
      ${isCurrent ? '<span class="chip chip-new">Поточний</span>' : ''}
    </a>
  `;
}

function getNextIssueNumber(currentNumber = '') {
  const numericParts = String(currentNumber).match(/\d+/g) ?? [];
  if (!numericParts.length) return '?';
  return Number(numericParts.at(-1)) + 1;
}
