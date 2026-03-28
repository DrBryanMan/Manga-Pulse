import { createMangaCard } from '../components/manga-card.js';

const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(r => r.json()));

const PUBLISHER_META = {
  shueisha:       { label: 'Shueisha',      color: '#e8453c' },
  kodansha:       { label: 'Kodansha',      color: '#5b8dee' },
  shogakukan:     { label: 'Shogakukan',    color: '#3ecf8e' },
  hakusensha:     { label: 'Hakusensha',    color: '#a78bfa' },
  'akita-shoten': { label: 'Akita Shoten',  color: '#f0943e' },
  'square-enix':  { label: 'Square Enix',   color: '#e2a74a' },
};

const FORMAT_LABELS = {
  weekly:   'Тижневий',
  biweekly: 'Двотижневий',
  monthly:  'Щомісячний',
  digital:  'Цифровий',
};

const DEMO_LABELS = {
  shounen: 'Shōnen',
  shoujo:  'Shōjo',
  seinen:  'Seinen',
  josei:   'Josei',
};

// ── Issue list generator ─────────────────────────────
function generateIssues(mag) {
  const stepDays = { weekly: 7, biweekly: 14, monthly: 30, digital: 1 };
  const step     = stepDays[mag.format] ?? 7;
  const base     = new Date('2026-03-27');

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() - i * step);
    return {
      num:       16 - i,
      year:      2026,
      dateLabel: d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }),
      isCurrent: i === 0,
    };
  });
}

// ── Entry point ──────────────────────────────────────
export async function renderMagazineDetail(container, { slug }) {
  container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Завантаження…</p></div>`;

  const [magazines, allSeries] = await Promise.all([
    fetchOnce('./data/magazines.json'),
    fetchOnce('./data/series.json'),
  ]);

  const mag = magazines.find(m => m.slug === slug);
  if (!mag) {
    container.innerHTML = `<div class="container page-body"><p>Журнал не знайдено.</p></div>`;
    return;
  }

  const pub    = PUBLISHER_META[mag.publisher] ?? { label: mag.publisher, color: '#5b8dee' };
  const series = allSeries.filter(s => s.magazine_slug === slug);
  const issues = generateIssues(mag);

  container.innerHTML = buildHTML(mag, pub, series, issues);
}

// ── HTML builder ─────────────────────────────────────
function buildHTML(mag, pub, series, issues) {
  const seriesHTML = series.length
    ? `<div class="manga-grid">${series.map(s => createMangaCard(s).outerHTML).join('')}</div>`
    : `<p style="color:var(--text-muted);padding:20px 0">Серій з каталогу не знайдено.</p>`;

  const issueRows = issues.map(iss => `
    <a class="mag-issue-row${iss.isCurrent ? ' current' : ''}"
       href="#/magazines/${esc(mag.slug)}/${iss.year}-${iss.num}">
      <div class="mag-issue-num">#${iss.num}</div>
      <div class="mag-issue-date">${esc(iss.dateLabel)} ${iss.year}</div>
      <div class="mag-issue-series">${mag.series_count} серій</div>
      ${iss.isCurrent ? '<span class="chip chip-new">Поточний</span>' : ''}
    </a>`).join('');

  return `
    <div class="container page-body">
      <a class="back-btn" href="#/magazines">← Назад до журналів</a>

      <div class="mag-detail-hero" style="--pub-color:${pub.color}">
        <div class="mag-detail-accent"></div>
        <div class="mag-detail-content">
          <div class="mag-detail-label">${esc(mag.label)}</div>
          <div class="mag-detail-title">${esc(mag.title)}</div>
          <div class="mag-detail-ja">${esc(mag.title_ja)}</div>
          <div class="mag-detail-badges">
            <span class="chip chip-weekly">${esc(FORMAT_LABELS[mag.format] ?? mag.format)}</span>
            <span class="mag-badge" style="font-size:11px;font-weight:500;color:var(--text-2);padding:3px 8px;border:1px solid var(--border-s);border-radius:50px;background:var(--bg-2)">${esc(DEMO_LABELS[mag.demographic] ?? mag.demographic)}</span>
            <span style="font-size:12px;color:${pub.color};font-weight:600">${esc(pub.label)}</span>
          </div>
          <div class="mag-detail-stats">
            <div class="mag-dstat">
              <span class="mag-dstat-val">${mag.series_count}</span>
              <span class="mag-dstat-lbl">Серій</span>
            </div>
            <div class="mag-dstat">
              <span class="mag-dstat-val">${esc(mag.circulation)}</span>
              <span class="mag-dstat-lbl">Тираж</span>
            </div>
            <div class="mag-dstat">
              <span class="mag-dstat-val">${mag.year}</span>
              <span class="mag-dstat-lbl">З року</span>
            </div>
          </div>
          <div class="mag-detail-next">
            <span class="mag-next-lbl">${esc(mag.next_label)}</span>
            <span class="mag-next-date">${esc(mag.next_issue)}</span>
          </div>
        </div>
      </div>

      <div class="mag-detail-grid">
        <div class="mag-detail-main">
          <div class="section">
            <div class="section-header">
              <h2 class="section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Серії у журналі
              </h2>
              <span class="section-label">${series.length} у каталозі</span>
            </div>
            ${seriesHTML}
          </div>
        </div>

        <aside class="mag-detail-aside">
          <div class="section">
            <div class="section-header">
              <h2 class="section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Останні випуски
              </h2>
            </div>
            <div class="mag-issues-list">${issueRows}</div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC_MAP[c]);