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
import { icon } from '../icons.js';

const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(response => {
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}));

const seriesDetailsCache = new Map();

export async function renderMagazineDetail(container, { slug, subpage = '' }) {
  container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Завантаження…</p></div>`;

  try {
    const [magazines, seriesCatalog, magazineAnalytics] = await Promise.all([
      fetchOnce('./data/magazines.json'),
      fetchOnce('./data/series.json'),
      fetchOnce('./data/analytics_magazines.json'),
    ]);

    const mag = magazines.find(item => item.slug === slug);
    if (!mag) {
      container.innerHTML = `<div class="container page-body"><p>Журнал не знайдено.</p></div>`;
      return;
    }

    const detailedMagazine = await fetchMagazineFile(mag);
    const analytics        = magazineAnalytics[slug];
    const resolver         = createSeriesResolver(seriesCatalog, slug);
    const magazineData     = buildMagazineViewModel(mag, detailedMagazine, analytics, seriesCatalog, resolver);
    const allSeries        = magazineData.seriesIds.length
      ? await buildMagazineSeries(seriesCatalog, magazineData, slug, resolver)
      : buildFallbackSeries(seriesCatalog, slug, resolver);
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

function buildMagazineViewModel(mag, detailedMagazine, analytics = {}, seriesCatalog = [], resolver) {
  const issues         = (detailedMagazine?.issues ?? []).filter(issue => issue?.number);
  const issuesWithDate = issues.filter(issue => parseIssueDate(issue.release_date));
  const firstIssue     = issuesWithDate[0] ?? null;
  const lastIssue      = issuesWithDate.at(-1) ?? null;
  const periodicity    = getPeriodicityMeta(detailedMagazine?.format ?? mag.format);
  const nextIssueDate  = lastIssue ? getNextIssueDate(lastIssue.release_date, detailedMagazine?.format ?? mag.format, detailedMagazine?.breaks ?? []) : null;
  const fallbackIssues = issues.length ? issues : generateFallbackIssues(mag);
  const fallbackSeries = seriesCatalog.filter(series => series.magazine_slug === mag.slug);
  const issueSeriesIds = [...new Set(
    fallbackIssues
      .flatMap(issue => issue.series ?? [])
      .map(value => normalizeSeriesKey(value, resolver))
      .filter(Boolean),
  )];

  const seriesIds = [...new Set(
    (analytics.series ?? issueSeriesIds)
      .map(value => normalizeSeriesKey(value, resolver))
      .filter(Boolean),
  )];

  const ongoingIds = new Set(
    (analytics.ongoings ?? [])
      .map(value => normalizeSeriesKey(value, resolver))
      .filter(Boolean),
  );

  return {
    title:        detailedMagazine?.title ?? mag.title,
    title_ja:     detailedMagazine?.title_ja ?? mag.title_ja,
    label:        detailedMagazine?.label ?? mag.label,
    demographic:  detailedMagazine?.demographic ?? mag.demographic,
    format:       detailedMagazine?.format ?? mag.format,
    year:         firstIssue ? parseIssueDate(firstIssue.release_date)?.getFullYear() : mag.year,
    issuesCount:  fallbackIssues.length,
    issues:       fallbackIssues,
    seriesIds:    seriesIds.length ? seriesIds : fallbackSeries.map(series => normalizeSeriesKey(series.mal_id, resolver)).filter(Boolean),
    ongoingIds,
    nextIssue:    nextIssueDate ? `#${getNextIssueNumber(lastIssue?.number)} — ${formatUkDate(nextIssueDate, { day: 'numeric', month: 'long' })}` : (mag.next_issue ?? 'Невідомо'),
    nextLabel:    nextIssueDate ? 'Наступний номер' : (mag.next_label ?? 'Наступний номер'),
    periodicity,
  };
}

async function buildMagazineSeries(seriesCatalog, magazineData, slug, resolver) {
  const legacyByMalId = new Map(
    seriesCatalog
      .filter(series => series.magazine_slug === slug)
      .map(series => [normalizeSeriesKey(series.mal_id, resolver), series]),
  );

  return Promise.all(
    magazineData.seriesIds.map(async seriesKey => {
      const normalizedKey = normalizeSeriesKey(seriesKey, resolver);
      const detail = await findSeriesDetail(normalizedKey, slug);
      const legacy = legacyByMalId.get(normalizedKey) ?? null;
      const latestIssueWithSeries = [...magazineData.issues]
        .reverse()
        .find(issue => (issue.series ?? []).map(value => normalizeSeriesKey(value, resolver)).includes(normalizedKey) && parseIssueDate(issue.release_date));

      const status = magazineData.ongoingIds.has(normalizedKey) ? 'active' : (detail?.status ?? legacy?.status ?? 'done');
      const latestChapter = getLatestChapterNumber(detail, legacy);
      const latestChapterDate = status === 'active'
        ? detail?.next_chapter_date ?? legacy?.next_chapter_date ?? null
        : latestIssueWithSeries?.release_date ?? getLatestChapterDate(detail) ?? legacy?.next_chapter_date ?? null;

      return {
        key:               normalizedKey,
        id:                detail?.mal_id ?? legacy?.mal_id ?? '',
        href:              getSeriesHref(detail, legacy),
        title:             detail?.title ?? legacy?.title ?? `Серія ${normalizedKey}`,
        title_ua:          detail?.title_ua ?? legacy?.title_ua ?? '',
        poster:            detail?.poster ?? legacy?.poster ?? '',
        magazine_slug:     legacy?.magazine_slug ?? slug,
        score:             legacy?.score ?? null,
        chapter:           latestChapter,
        status,
        next_chapter_date: latestChapterDate,
      };
    }),
  );
}

async function findSeriesDetail(seriesKey, slug) {
  const cacheKey = `${slug}:${seriesKey}`;
  if (seriesDetailsCache.has(cacheKey)) {
    return seriesDetailsCache.get(cacheKey);
  }

  try {
    const detail = await fetchOnce(`./data/series/${seriesKey}.json`);
    seriesDetailsCache.set(cacheKey, detail);
    return detail;
  } catch {
    seriesDetailsCache.set(cacheKey, null);
    return null;
  }
}

function buildFallbackSeries(seriesCatalog, slug, resolver) {
  return seriesCatalog
    .filter(series => series.magazine_slug === slug)
    .map(series => ({
      key:               normalizeSeriesKey(series.mal_id, resolver),
      id:                series.mal_id ?? '',
      href:              getSeriesHref(null, series),
      title:             series.title,
      title_ua:          series.title_ua ?? '',
      poster:            series.poster ?? '',
      magazine_slug:     series.magazine_slug,
      score:             series.score ?? null,
      chapter:           series.chapter ?? null,
      status:            series.status ?? 'done',
      next_chapter_date: series.next_chapter_date ?? null,
    }))
    .filter(series => series.key);
}

function createSeriesResolver(seriesCatalog, slug) {
  const aliases = new Map();

  seriesCatalog
    .filter(series => series.magazine_slug === slug)
    .forEach(series => {
      const malId = normalizeSeriesKey(series.mal_id);
      if (!malId) return;

      aliases.set(malId, malId);
      if (series.hikka_slug) aliases.set(String(series.hikka_slug), malId);
      if (series.id) aliases.set(String(series.id), malId);

      const suffix = String(series.hikka_slug ?? '').split('-').filter(Boolean).at(-1);
      if (suffix) aliases.set(suffix, malId);
    });

  return value => aliases.get(String(value ?? '').trim()) ?? normalizeSeriesKey(value);
}

function getLatestChapterNumber(detail, legacy) {
  if (Array.isArray(detail?.chapters) && detail.chapters.length) {
    const startsAtZero = [
      detail?.chapters_starts_at_zero,
      detail?.chapters_start_from_zero,
      detail?.chapter_start_from_zero,
      detail?.starts_from_zero,
    ].some(Boolean);
    return startsAtZero ? detail.chapters.length - 1 : detail.chapters.length;
  }

  return legacy?.chapter ?? null;
}

function getLatestChapterDate(detail) {
  if (!Array.isArray(detail?.chapters)) return null;

  const dated = [...detail.chapters]
    .reverse()
    .find(chapter => parseIssueDate(chapter.release_date));

  return dated?.release_date ?? null;
}

function getSeriesHref(detail, legacy) {
  const routeKey = detail?.mal_id ?? legacy?.mal_id ?? detail?.slug ?? legacy?.hikka_slug ?? '';
  return routeKey ? `#/series/${routeKey}` : '';
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

  const visibleIssues = [...magazineData.issues];
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
                <h2 class="section-title">${icon('three-line')} Поточні серії (${activeSeries.length})</h2>
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
                <h2 class="section-title">${icon('calendar')} Останні випуски</h2>
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

function normalizeSeriesKey(value, resolver = null) {
  const normalized = String(value ?? '').trim();
  return resolver ? resolver(normalized) : normalized;
}
