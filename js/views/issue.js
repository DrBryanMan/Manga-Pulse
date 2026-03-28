const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(r => r.json()));

const PUBLISHER_META = {
  shueisha:       { label: 'Shueisha',     color: '#e8453c' },
  kodansha:       { label: 'Kodansha',     color: '#5b8dee' },
  shogakukan:     { label: 'Shogakukan',   color: '#3ecf8e' },
  hakusensha:     { label: 'Hakusensha',   color: '#a78bfa' },
  'akita-shoten': { label: 'Akita Shoten', color: '#f0943e' },
  'square-enix':  { label: 'Square Enix',  color: '#e2a74a' },
};

const FORMAT_LABELS = {
  weekly:   'Тижневий',
  biweekly: 'Двотижневий',
  monthly:  'Щомісячний',
  digital:  'Цифровий',
};

const DOT_CLASS = {
  'wsj':       'dot-wsj',
  'sj-plus':   'dot-sjplus',
  'morning':   'dot-morning',
  'afternoon': 'dot-afternoon',
  'young-animal': 'dot-ya',
  'wss':       'dot-wss',
  'wsm':       'dot-wsm',
};

// Subtitles for mock issue series rows
const SUBTITLES = [
  'Нова арка розпочалась', 'Вирішальна битва', 'Прихід нового ворога',
  'Подорож продовжується', 'Несподіваний союз', 'Темне одкровення',
  'Межа можливого', 'Серце монстра', 'Останній шанс',
];

// ── Entry point ──────────────────────────────────────
export async function renderIssue(container, { slug, issue }) {
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

  // Parse "2026-16" → year=2026, num=16
  const [year, num] = (issue ?? '').split('-').map(Number);
  const issueNum    = num  || 16;
  const issueYear   = year || 2026;

  // Series ranked by score, filtered for this magazine
  const magSeries   = allSeries
    .filter(s => s.magazine_slug === slug)
    .sort((a, b) => b.score - a.score);

  const issueDate   = buildIssueDate(mag, issueNum, issueYear);
  const pub         = PUBLISHER_META[mag.publisher] ?? { label: mag.publisher, color: '#5b8dee' };

  container.innerHTML = buildHTML(mag, pub, issueNum, issueYear, issueDate, magSeries);
}

// ── Date calculation ─────────────────────────────────
function buildIssueDate(mag, num, year) {
  const base = new Date(year, 2, 27); // ~March 27 for issue 16
  const step = { weekly: 7, biweekly: 14, monthly: 30, digital: 7 }[mag.format] ?? 7;
  base.setDate(base.getDate() - (16 - num) * step);
  return base.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
}

// ── HTML builder ─────────────────────────────────────
function buildHTML(mag, pub, num, year, dateStr, series) {
  const coverBrand = mag.title.includes('Jump')  ? ['Weekly', 'Shōnen', 'JUMP'] :
                     mag.title.includes('Sunday') ? ['Weekly', 'Shōnen', 'SUNDAY'] :
                     mag.title.includes('Morning')? ['Weekly', 'MORNING', '']  :
                     [mag.label, '', ''];

  const dotCls = DOT_CLASS[mag.slug] ?? '';

  const totalPages = series.reduce((acc, _, i) => acc + 16 + (i % 8), 0);
  const specials   = Math.max(1, Math.floor(series.length / 5));
  const newSeries  = Math.max(1, Math.floor(series.length / 8));

  const seriesRows = series.map((s, i) => buildSeriesRow(s, i, mag.slug)).join('');

  const hiddenCount = Math.max(0, mag.series_count - series.length);
  const hiddenRow   = hiddenCount > 0 ? `
    <div class="issue-row-more">
      <div class="issue-pos" style="color:var(--text-muted);font-size:11px">…</div>
      <span>Ще ${hiddenCount} серій у цьому номері</span>
    </div>` : '';

  return `
    <div class="container page-body">
      <a class="back-btn" href="#/magazines/${esc(mag.slug)}">← Назад до журналу</a>

      <div class="issue-hero">
        <div class="issue-cover">
          <div class="issue-cover-inner">
            <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:${pub.color};text-transform:uppercase">${esc(coverBrand[0])}</div>
            ${coverBrand[1] ? `<div class="issue-cover-brand">${esc(coverBrand[1])}</div>` : ''}
            ${coverBrand[2] ? `<div class="issue-cover-brand" style="font-size:18px">${esc(coverBrand[2])}</div>` : ''}
            <div class="issue-cover-num">#${num}</div>
            <div class="issue-cover-year">${year}</div>
          </div>
        </div>

        <div class="issue-info">
          <div class="issue-mag-lbl">${esc(mag.title)}</div>
          <div class="issue-title">Випуск #${num} / ${year}</div>
          <div class="issue-date">Дата виходу: <strong>${esc(dateStr)}</strong></div>

          <div class="issue-stats">
            <div class="issue-stat">
              <div class="issue-stat-val">${mag.series_count}</div>
              <div class="issue-stat-lbl">Серій</div>
            </div>
            <div class="issue-stat">
              <div class="issue-stat-val">${totalPages}</div>
              <div class="issue-stat-lbl">Сторінок</div>
            </div>
            <div class="issue-stat">
              <div class="issue-stat-val" style="color:var(--gold)">${specials}</div>
              <div class="issue-stat-lbl">Спешлів</div>
            </div>
            <div class="issue-stat">
              <div class="issue-stat-val" style="color:var(--green)">${newSeries}</div>
              <div class="issue-stat-lbl">Нових серій</div>
            </div>
          </div>

          <div class="issue-info-chips">
            <span class="chip chip-weekly">${esc(FORMAT_LABELS[mag.format] ?? mag.format)}</span>
            <span class="mag-chip"><span class="mag-dot ${dotCls}"></span>${esc(pub.label)}</span>
            <span class="chip chip-ongoing">Вийшов</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Серії в номері
          </h2>
          <span class="section-label">Порядок — рейтинг читачів</span>
        </div>

        <div class="issue-list">
          ${seriesRows}
          ${hiddenRow}
        </div>
      </div>
    </div>
  `;
}

function buildSeriesRow(s, index, magSlug) {
  const pos      = index + 1;
  const posColor = pos === 1 ? 'var(--gold)' : pos === 2 ? 'var(--text-2)' : pos === 3 ? 'var(--orange)' : 'var(--text-muted)';
  const posCls   = pos <= 3 ? ` pos-${pos}` : '';
  const subtitle = SUBTITLES[s.id.length % SUBTITLES.length];
  const pages    = 16 + (pos % 9);

  return `
    <a class="issue-row${posCls}" href="#/series/${esc(s.id)}">
      <div class="issue-pos" style="color:${posColor}">${pos}</div>
      <img class="issue-thumb" src="${esc(s.poster)}" alt="${esc(s.title)}" loading="lazy">
      <div class="issue-series-info">
        <div class="issue-series-title">${esc(s.title)}</div>
        <div class="issue-series-sub">${esc(subtitle)}</div>
      </div>
      <div class="issue-ch">Розд. ${s.chapter}</div>
      <div class="issue-pages">${pages} стор.</div>
    </a>
  `;
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC_MAP[c]);