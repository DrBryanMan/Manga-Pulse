// js/views/calendar.js

const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(r => r.json()));

const STEP_DAYS = { weekly: 7, biweekly: 14, monthly: 30, digital: 3 };

const MONTHS_UK     = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                        'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const MONTHS_UK_GEN = ['січня','лютого','березня','квітня','травня','червня',
                        'липня','серпня','вересня','жовтня','листопада','грудня'];
const DAYS_UK_FULL  = ['Понеділок','Вівторок','Середа','Четвер',"П'ятниця",'Субота','Неділя'];
const DAYS_UK_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

const PUB_COLORS = {
  shueisha:       '#e8453c',
  kodansha:       '#5b8dee',
  shogakukan:     '#3ecf8e',
  hakusensha:     '#a78bfa',
  'akita-shoten': '#f0943e',
  'square-enix':  '#e2a74a',
};

// SVG calendar icon for "Today" button
const ICON_CAL = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="4" width="18" height="18" rx="2"/>
  <line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8" y1="2" x2="8" y2="6"/>
  <line x1="3" y1="10" x2="21" y2="10"/>
</svg>`;

// ── Module state ─────────────────────────────────────
let allSeries    = [];
let allMagazines = [];
let magazineMap  = {};
let schedule     = new Map();   // dateKey → Map<slug, series[]>
let selectedDate = null;
let currentView  = 'week';
let currentYear  = 0;
let currentMonth = 0;
let weekStart    = null;

// ── Entry point ──────────────────────────────────────
export async function renderCalendar(container) {
  const today = midnight(new Date());
  currentYear  = today.getFullYear();
  currentMonth = today.getMonth();
  weekStart    = getMonday(today);
  selectedDate = toKey(today);

  container.innerHTML = '<div class="container page-body" style="color:var(--text-muted)">Завантаження…</div>';

  [allSeries, allMagazines] = await Promise.all([
    fetchOnce('./data/series.json'),
    fetchOnce('./data/magazines.json'),
  ]);

  magazineMap = Object.fromEntries(allMagazines.map(m => [m.slug, m]));

  rebuildSchedule();
  container.innerHTML = skeleton();
  fullRender();
  bindEvents(container);
}

// ── Date helpers ─────────────────────────────────────
function midnight(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function todayKey() { return toKey(midnight(new Date())); }

function getMonday(d) {
  const r   = midnight(d);
  const dow = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - dow);
  return r;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── Schedule builder ─────────────────────────────────
function rebuildSchedule() {
  schedule.clear();

  const rangeStart = new Date(currentYear, currentMonth - 1, 1);
  const rangeEnd   = new Date(currentYear, currentMonth + 2, 0);

  for (const s of allSeries) {
    if (s.status === 'done') continue;

    const raw    = s.next_chapter_date;
    const anchor = raw === 'today' ? midnight(new Date())
                 : raw             ? midnight(new Date(raw))
                 : null;

    if (!anchor || isNaN(anchor.getTime())) continue;

    const mag  = magazineMap[s.magazine_slug];
    const step = STEP_DAYS[mag?.format ?? 'weekly'];

    const d = new Date(anchor);
    while (d >= rangeStart) d.setDate(d.getDate() - step);
    d.setDate(d.getDate() + step);

    while (d <= rangeEnd) {
      if (d >= rangeStart) {
        const key    = toKey(d);
        const offset = Math.round((d - anchor) / (step * 86_400_000));

        schedule.has(key) || schedule.set(key, new Map());
        const dayMap = schedule.get(key);
        dayMap.has(s.magazine_slug) || dayMap.set(s.magazine_slug, []);
        dayMap.get(s.magazine_slug).push({ ...s, chapter: s.chapter + offset });
      }
      d.setDate(d.getDate() + step);
    }
  }
}

// ── HTML skeleton ─────────────────────────────────────
function skeleton() {
  return `
    <div class="container page-body">
      <div class="page-header">
        <h1 class="page-title">Календар виходів</h1>
        <p class="page-subtitle">Розклад релізів манґи по журналах та датах</p>
      </div>

      <div class="cal-stats" id="cal-stats"></div>

      <div class="cal-toolbar">
        <div class="cal-toolbar-nav">
          <button class="cal-nav-btn" id="cal-prev">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span class="cal-month-lbl" id="cal-month-lbl"></span>
          <button class="cal-nav-btn" id="cal-next">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button class="cal-nav-btn cal-today-btn" id="cal-today-btn" title="Сьогодні">${ICON_CAL}</button>
        </div>

        <div class="cal-view-toggle">
          <button class="cal-view-btn" id="vbtn-week"  data-view="week">Тиждень</button>
          <button class="cal-view-btn" id="vbtn-month" data-view="month">Місяць</button>
        </div>
      </div>

      <div id="cal-body"></div>
    </div>`;
}

// ── Full render ───────────────────────────────────────
function fullRender() {
  renderStats();
  renderLabel();
  renderBody();
  syncViewBtns();
}

function renderBody() {
  currentView === 'week' ? renderWeek() : renderMonth();
}

// ── Stats ─────────────────────────────────────────────
function renderStats() {
  const tk    = todayKey();
  const today = midnight(new Date());

  const todayCount = flatDay(tk).length;
  let weekCount = 0;
  for (let i = 0; i < 7; i++) weekCount += flatDay(toKey(addDays(today, i))).length;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  let monthCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    monthCount += flatDay(`${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`).length;
  }

  const activeSeries = allSeries.filter(s => s.status === 'active').length;

  document.getElementById('cal-stats').innerHTML = [
    statChip(todayCount,   'Виходів сьогодні',    'var(--accent)'),
    statChip(weekCount,    'Виходів цього тижня', 'var(--green)'),
    statChip(monthCount,   'Виходів у місяці',    'var(--gold)'),
    statChip(activeSeries, 'Активних серій',      'var(--purple)'),
  ].join('');
}

function statChip(val, label, color) {
  return `<div class="cal-stat-chip">
    <div class="cal-stat-val" style="color:${color}">${val}</div>
    <div class="cal-stat-label">${label}</div>
  </div>`;
}

function flatDay(key) {
  return [...(schedule.get(key)?.values() ?? [])].flat();
}

// ── Label ─────────────────────────────────────────────
function renderLabel() {
  const lbl = document.getElementById('cal-month-lbl');
  if (!lbl) return;

  if (currentView === 'week') {
    const wEnd      = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === wEnd.getMonth();
    lbl.textContent = sameMonth
      ? `${weekStart.getDate()}–${wEnd.getDate()} ${MONTHS_UK_GEN[wEnd.getMonth()]} ${wEnd.getFullYear()}`
      : `${weekStart.getDate()} ${MONTHS_UK_GEN[weekStart.getMonth()]} – ${wEnd.getDate()} ${MONTHS_UK_GEN[wEnd.getMonth()]} ${wEnd.getFullYear()}`;
  } else {
    lbl.textContent = `${MONTHS_UK[currentMonth]} ${currentYear}`;
  }
}

// ════════════════════════════════════════════════════
// WEEK VIEW — full width, large covers
// ════════════════════════════════════════════════════
function renderWeek() {
  const body = document.getElementById('cal-body');
  if (!body) return;

  const tk   = todayKey();
  const cols = Array.from({ length: 7 }, (_, i) => {
    const d   = addDays(weekStart, i);
    const key = toKey(d);
    return buildWeekCol(d, key, key === tk);
  }).join('');

  body.innerHTML = `
    <div class="cal-week-grid">${cols}</div>
    ${buildLegend()}`;
}

function buildWeekCol(d, key, isToday) {
  const dayMap = schedule.get(key);
  const dow    = (d.getDay() + 6) % 7;

  const numHtml = isToday
    ? `<div class="cal-week-num today-num">${d.getDate()}</div>`
    : `<div class="cal-week-num">${d.getDate()}</div>`;

  const countBadge = dayMap
    ? `<div class="cal-week-count">${flatDayMap(dayMap).length}</div>`
    : '';

  // Group by magazine → big cover grid
  const magSections = dayMap
    ? [...dayMap.entries()].map(([slug, series]) => {
        const mag   = magazineMap[slug];
        const color = pubColor(mag);

        const covers = series.map(s => `
          <a class="cal-cover-card" href="#/series/${esc(s.mal_id ?? s.id ?? '')}">
            <img class="cal-cover-img" src="${esc(s.poster)}" alt="${esc(s.title)}" loading="lazy">
            <div class="cal-cover-info">
              <div class="cal-cover-title">${esc(s.title)}</div>
              <div class="cal-cover-ch">Розд.&nbsp;${s.chapter}</div>
            </div>
          </a>`).join('');

        return `<div class="cal-week-mag-section" style="--tag-color:${color}">
          <div class="cal-week-mag-hdr">
            <span class="cal-mag-dot"></span>
            <span class="cal-week-mag-lbl">${esc(mag?.label ?? slug)}</span>
            <span class="cal-week-mag-cnt">${series.length}</span>
          </div>
          <div class="cal-cover-grid">${covers}</div>
        </div>`;
      }).join('')
    : `<div class="cal-week-empty">—</div>`;

  const cls = ['cal-week-col', isToday && 'today-col'].filter(Boolean).join(' ');

  return `<div class="${cls}">
    <div class="cal-week-hdr">
      <div class="cal-week-day">${DAYS_UK_SHORT[dow]}</div>
      ${numHtml}
      ${countBadge}
    </div>
    <div class="cal-week-body">${magSections}</div>
  </div>`;
}

function flatDayMap(dayMap) {
  return [...dayMap.values()].flat();
}

// ════════════════════════════════════════════════════
// MONTH VIEW — 70/30 with panel
// ════════════════════════════════════════════════════
function renderMonth() {
  const body = document.getElementById('cal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="cal-layout">
      <div class="cal-main" id="cal-main"></div>
      <aside class="cal-panel" id="cal-panel"></aside>
    </div>`;

  renderMonthGrid();
  renderPanel(selectedDate);
}

function renderMonthGrid() {
  const main = document.getElementById('cal-main');
  if (!main) return;

  const tk          = todayKey();
  const firstDay    = new Date(currentYear, currentMonth, 1);
  const lastDay     = new Date(currentYear, currentMonth + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const prevLast    = new Date(currentYear, currentMonth, 0).getDate();

  const headers   = DAYS_UK_SHORT.map(d => `<div class="cal-day-hdr">${d}</div>`).join('');
  const prevCells = Array.from({ length: startOffset }, (_, i) =>
    `<div class="cal-cell other-month"><div class="cal-num">${prevLast - startOffset + 1 + i}</div></div>`
  );
  const currCells = Array.from({ length: lastDay.getDate() }, (_, i) => {
    const day = i + 1;
    const key = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;
    return buildMonthCell(day, key, key === tk, key === selectedDate);
  });
  const trailing = (7 - ((prevCells.length + currCells.length) % 7)) % 7;
  const trailCells = Array.from({ length: trailing }, (_, i) =>
    `<div class="cal-cell other-month"><div class="cal-num">${i + 1}</div></div>`
  );

  main.innerHTML = `
    <div class="cal-grid">
      ${headers}
      ${prevCells.join('')}${currCells.join('')}${trailCells.join('')}
    </div>
    ${buildLegend()}`;

  main.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => selectDate(cell.dataset.date));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selectDate(cell.dataset.date);
    });
  });
}

function buildMonthCell(day, key, isToday, isSelected) {
  const dayMap = schedule.get(key);
  const tags   = dayMap
    ? [...dayMap.entries()].slice(0, 3).map(([slug, series]) => {
        const color = pubColor(magazineMap[slug]);
        return `<div class="cal-mag-tag" style="--tag-color:${color}">
          <span class="cal-mag-dot"></span>
          <span>${esc(magazineMap[slug]?.label ?? slug)}</span>
          <span class="cal-mag-count">${series.length}</span>
        </div>`;
      }).join('')
    : '';

  const more = dayMap && dayMap.size > 3
    ? `<div class="cal-mag-more">+${dayMap.size - 3} журн.</div>`
    : '';

  const cls = ['cal-cell', isToday && 'today-cell', isSelected && 'selected-cell', dayMap && 'has-events']
    .filter(Boolean).join(' ');

  return `<div class="${cls}" data-date="${key}" tabindex="0" role="button">
    <div class="cal-num">${day}</div>
    ${tags}${more}
  </div>`;
}

// ── Legend ────────────────────────────────────────────
function buildLegend() {
  const seen = new Set();
  const keys = currentView === 'week'
    ? Array.from({ length: 7 }, (_, i) => toKey(addDays(weekStart, i)))
    : Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() },
        (_, i) => `${currentYear}-${pad(currentMonth + 1)}-${pad(i + 1)}`);

  for (const key of keys) schedule.get(key)?.forEach((_, slug) => seen.add(slug));

  const items = [...seen].slice(0, 8).map(slug => {
    const color = pubColor(magazineMap[slug]);
    return `<div class="cal-legend-item">
      <span class="cal-legend-dot" style="background:${color}"></span>
      ${esc(magazineMap[slug]?.label ?? slug)}
    </div>`;
  }).join('');

  return items ? `<div class="cal-legend">${items}</div>` : '';
}

function pubColor(mag) {
  return mag ? (PUB_COLORS[mag.publisher] ?? 'var(--accent)') : 'var(--accent)';
}

// ── Date selection (month only) ───────────────────────
function selectDate(key) {
  selectedDate = key;
  document.querySelectorAll('.cal-cell.selected-cell')
    .forEach(el => el.classList.remove('selected-cell'));
  document.querySelector(`.cal-cell[data-date="${key}"]`)?.classList.add('selected-cell');
  renderPanel(key);
}

// ── Right panel (month view) ──────────────────────────
function renderPanel(key) {
  const panel = document.getElementById('cal-panel');
  if (!panel) return;

  const dayMap = schedule.get(key);
  const d      = new Date(`${key}T00:00:00`);
  const label  = d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!dayMap || dayMap.size === 0) {
    panel.innerHTML = `
      <div class="cal-panel-header">
        <div class="cal-panel-date">${esc(label)}</div>
      </div>
      <div class="cal-panel-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>Виходів не заплановано</span>
      </div>`;
    return;
  }

  const total  = flatDayMap(dayMap).length;
  const blocks = [...dayMap.entries()].map(([slug, series]) => {
    const mag   = magazineMap[slug];
    const color = pubColor(mag);
    const rows  = series.map(s => `
      <a class="cal-panel-series" href="#/series/${esc(s.mal_id ?? s.id ?? '')}">
        <img class="cal-panel-thumb" src="${esc(s.poster)}" alt="${esc(s.title)}" loading="lazy">
        <div class="cal-panel-series-info">
          <div class="cal-panel-series-title">${esc(s.title)}</div>
          ${s.title_ua ? `<div class="cal-panel-series-ua">${esc(s.title_ua)}</div>` : ''}
        </div>
        <div class="cal-panel-ch">Гл.&nbsp;${s.chapter}</div>
      </a>`).join('');

    return `<div class="cal-panel-mag" style="--mag-color:${color}">
      <div class="cal-panel-mag-header">
        <div class="cal-panel-mag-accent"></div>
        <div class="cal-panel-mag-label">
          <span class="cal-panel-mag-name">${esc(mag?.label ?? slug)}</span>
          <span class="cal-panel-mag-full">${esc(mag?.title ?? '')}</span>
        </div>
        <a class="cal-panel-mag-count" href="#/magazines/${esc(slug)}">${series.length}</a>
      </div>
      <div class="cal-panel-series-list">${rows}</div>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="cal-panel-header">
      <div class="cal-panel-date">${esc(label)}</div>
      <div class="cal-panel-total">${total} ${plural(total, 'вихід', 'виходи', 'виходів')}</div>
    </div>
    <div class="cal-panel-body">${blocks}</div>`;
}

// ── Navigation ────────────────────────────────────────
function shiftPeriod(delta) {
  if (currentView === 'week') {
    weekStart    = addDays(weekStart, delta * 7);
    const mid    = addDays(weekStart, 3);
    currentYear  = mid.getFullYear();
    currentMonth = mid.getMonth();
    rebuildSchedule();
    renderLabel();
    renderWeek();
    renderStats();
  } else {
    currentMonth += delta;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
    rebuildSchedule();

    const today = midnight(new Date());
    selectedDate = (today.getFullYear() === currentYear && today.getMonth() === currentMonth)
      ? toKey(today)
      : `${currentYear}-${pad(currentMonth + 1)}-01`;

    renderLabel();
    renderMonthGrid();
    renderPanel(selectedDate);
    renderStats();
  }
}

function goToday() {
  const today  = midnight(new Date());
  weekStart    = getMonday(today);
  currentYear  = today.getFullYear();
  currentMonth = today.getMonth();
  selectedDate = toKey(today);
  rebuildSchedule();
  renderLabel();
  renderBody();
  renderStats();
}

function switchView(view) {
  if (currentView === view) return;
  currentView = view;

  if (view === 'week') {
    weekStart = getMonday(new Date(`${selectedDate}T00:00:00`));
  } else {
    const d  = new Date(`${selectedDate}T00:00:00`);
    currentYear  = d.getFullYear();
    currentMonth = d.getMonth();
  }

  rebuildSchedule();
  renderLabel();
  renderBody();
  syncViewBtns();
}

function syncViewBtns() {
  document.getElementById('vbtn-week')?.classList.toggle('active', currentView === 'week');
  document.getElementById('vbtn-month')?.classList.toggle('active', currentView === 'month');
}

// ── Events ────────────────────────────────────────────
function bindEvents(container) {
  container.querySelector('#cal-prev')?.addEventListener('click',      () => shiftPeriod(-1));
  container.querySelector('#cal-next')?.addEventListener('click',      () => shiftPeriod(1));
  container.querySelector('#cal-today-btn')?.addEventListener('click', goToday);
  container.querySelector('#vbtn-week')?.addEventListener('click',     () => switchView('week'));
  container.querySelector('#vbtn-month')?.addEventListener('click',    () => switchView('month'));
}

// ── Helpers ───────────────────────────────────────────
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1)                return one;
  if (m10 >= 2 && m10 <= 4)    return few;
  return many;
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC_MAP[c]);