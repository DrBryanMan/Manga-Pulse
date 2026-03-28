// ── Publisher palette ────────────────────────────────
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

const DEMO_LABELS = {
  shounen: 'Shōnen',
  shoujo:  'Shōjo',
  seinen:  'Seinen',
  josei:   'Josei',
};

// ── Module cache ─────────────────────────────────────
let allMagazines = [];
const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(r => r.json()));

// ── Entry point ──────────────────────────────────────
export async function renderMagazines(container) {
  container.innerHTML = buildSkeleton();
  allMagazines = await fetchOnce('./data/magazines.json');
  populateSelects();
  bindEvents();
  render();
}

// ── Skeleton ─────────────────────────────────────────
function buildSkeleton() {
  return `
    <div class="container page-body">
      <div class="page-header">
        <h1 class="page-title">Журнали</h1>
      </div>

      <div class="filter-bar">
        <div class="filter-section results-section">
          <div>
            <div class="results-label">Журналів</div>
            <div class="results-value" id="results-number">…</div>
          </div>
        </div>

        <div class="filter-section search-section">
          <div class="search-inner">
            <span class="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input type="text" id="mag-search" class="search-input"
              placeholder="Назва журналу або видавця…" autocomplete="off">
          </div>
        </div>

        <div class="filter-section filters-section">
          <div class="select-wrap">
            <select id="filter-publisher" class="filter-select">
              <option value="">Всі видавці</option>
              ${Object.entries(PUBLISHER_META).map(([k, v]) =>
                `<option value="${k}">${v.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="select-wrap">
            <select id="filter-format" class="filter-select">
              <option value="">Будь-який формат</option>
              ${Object.entries(FORMAT_LABELS).map(([k, v]) =>
                `<option value="${k}">${v}</option>`
              ).join('')}
            </select>
          </div>
          <div class="select-wrap">
            <select id="filter-demo" class="filter-select">
              <option value="">Вся аудиторія</option>
              ${Object.entries(DEMO_LABELS).map(([k, v]) =>
                `<option value="${k}">${v}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="active-filters" id="active-filters"></div>
      <div class="mag-grid" id="mag-grid"></div>
    </div>
  `;
}

// ── Filters ──────────────────────────────────────────
function getFilters() {
  return {
    q:         document.getElementById('mag-search')?.value.trim().toLowerCase() ?? '',
    publisher: document.getElementById('filter-publisher')?.value ?? '',
    format:    document.getElementById('filter-format')?.value ?? '',
    demo:      document.getElementById('filter-demo')?.value ?? '',
  };
}

function applyFilters(magazines, { q, publisher, format, demo }) {
  return magazines.filter(m => {
    if (publisher && m.publisher    !== publisher) return false;
    if (format    && m.format       !== format)    return false;
    if (demo      && m.demographic  !== demo)      return false;
    if (q && !m.title.toLowerCase().includes(q) && !m.label.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ── Render ───────────────────────────────────────────
function render() {
  const filters  = getFilters();
  const filtered = applyFilters(allMagazines, filters);

  const grid  = document.getElementById('mag-grid');
  const count = document.getElementById('results-number');
  if (!grid) return;

  count.textContent = filtered.length.toLocaleString('uk-UA');
  renderPills(filters);

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="mag-empty">
        <div class="mag-empty-title">Нічого не знайдено</div>
        <p class="mag-empty-text">Спробуйте змінити запит або скинути фільтри.</p>
      </div>`;
    return;
  }

  grid.replaceChildren(...filtered.map(createMagCard));
}

// ── Pills ─────────────────────────────────────────────
const PILL_CONFIG = [
  { key: 'q',         elId: 'mag-search',       labelFn: v => `🔍 ${v}` },
  { key: 'publisher', elId: 'filter-publisher',  labelFn: v => PUBLISHER_META[v]?.label ?? v },
  { key: 'format',    elId: 'filter-format',     labelFn: v => FORMAT_LABELS[v] ?? v },
  { key: 'demo',      elId: 'filter-demo',       labelFn: v => DEMO_LABELS[v] ?? v },
];

function renderPills(filters) {
  const container = document.getElementById('active-filters');
  if (!container) return;

  const pills = PILL_CONFIG.flatMap(({ key, elId, labelFn }) => {
    const val = filters[key];
    if (!val) return [];
    const pill = document.createElement('button');
    pill.className = 'filter-pill';
    pill.innerHTML = `${esc(labelFn(val))}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`;
    pill.addEventListener('click', () => {
      const el = document.getElementById(elId);
      if (el) { el.value = ''; el.dispatchEvent(new Event('input')); }
      render();
    });
    return [pill];
  });

  container.replaceChildren(...pills);
}

// ── Card factory ──────────────────────────────────────
function createMagCard(mag) {
  const pub    = PUBLISHER_META[mag.publisher] ?? { label: mag.publisher, color: '#5b8dee' };
  const format = FORMAT_LABELS[mag.format]     ?? mag.format;
  const demo   = DEMO_LABELS[mag.demographic]  ?? mag.demographic;

  const a = document.createElement('a');
  a.className = 'mag-card';
  a.href = `#/magazines/${mag.slug}`;
  a.style.setProperty('--pub-color', pub.color);

  a.innerHTML = `
    <div class="mag-card-top">
      <div class="mag-card-accent"></div>
      <div class="mag-card-head">
        <div class="mag-card-label">${esc(mag.label)}</div>
        <div class="mag-card-badges">
          <span class="mag-badge">${demo}</span>
          <span class="mag-badge mag-badge-format">${format}</span>
        </div>
      </div>
      <div class="mag-card-title">${esc(mag.title)}</div>
      <div class="mag-card-ja">${esc(mag.title_ja)}</div>
      <div class="mag-card-pub" style="color:${pub.color}">${esc(pub.label)}</div>
    </div>
    <div class="mag-card-next">
      <div class="mag-next-lbl">${esc(mag.next_label)}</div>
      <div class="mag-next-date">${esc(mag.next_issue)}</div>
    </div>
    <div class="mag-card-stats">
      <div class="mag-stat">
        <span class="mag-stat-val">${mag.series_count}</span>
        <span class="mag-stat-lbl">Серій</span>
      </div>
      <div class="mag-stat">
        <span class="mag-stat-val">${esc(mag.circulation)}</span>
        <span class="mag-stat-lbl">Тираж</span>
      </div>
      <div class="mag-stat">
        <span class="mag-stat-val">${mag.year}</span>
        <span class="mag-stat-lbl">Рік</span>
      </div>
    </div>
  `;

  return a;
}

// ── Populate selects (no-op — вже вбудовано у skeleton) ──
function populateSelects() { /* selects rendered inline in buildSkeleton */ }

// ── Events ────────────────────────────────────────────
function bindEvents() {
  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(render, 180); };

  document.getElementById('mag-search')?.addEventListener('input', debounced);
  document.getElementById('filter-publisher')?.addEventListener('change', render);
  document.getElementById('filter-format')?.addEventListener('change', render);
  document.getElementById('filter-demo')?.addEventListener('change', render);
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC_MAP[c]);