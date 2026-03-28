// ── Publisher palette (кольори по видавництву) ──────
const PUBLISHER_META = {
  shueisha:    { label: 'Shueisha',     color: '#e8453c' },
  kodansha:    { label: 'Kodansha',     color: '#5b8dee' },
  shogakukan:  { label: 'Shogakukan',  color: '#3ecf8e' },
  hakusensha:  { label: 'Hakusensha',  color: '#a78bfa' },
  'akita-shoten': { label: 'Akita Shoten', color: '#f0943e' },
  'square-enix':  { label: 'Square Enix',  color: '#e2a74a' },
};

const FORMAT_LABELS = {
  weekly:    'Тижневий',
  biweekly:  'Двотижневий',
  monthly:   'Щомісячний',
  digital:   'Цифровий',
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
const fetchOnce  = (url) => (fetchCache[url] ??= fetch(url).then(r => r.json()));

// Active filter state
const state = { publisher: '', format: '', demographic: '' };

// ── Entry point ──────────────────────────────────────
export async function renderMagazines(container) {
  container.innerHTML = buildSkeleton();
  allMagazines = await fetchOnce('./data/magazines.json');
  bindEvents();
  render();
}

// ── Skeleton ─────────────────────────────────────────
function buildSkeleton() {
  return `
    <div class="container page-body">
      <div class="page-header">
        <h1 class="page-title">Журнали</h1>
        <p class="page-subtitle" id="mag-subtitle">…</p>
      </div>

      <div class="mag-filters">
        <div class="mag-filter-group">
          <span class="mag-filter-label">Видавець</span>
          <div class="mag-chip-row" id="filter-publisher" data-key="publisher">
            <button class="mag-chip active" data-value="">Всі</button>
            ${Object.entries(PUBLISHER_META).map(([k, v]) =>
              `<button class="mag-chip" data-value="${k}"
                style="--chip-color:${v.color}">${v.label}</button>`
            ).join('')}
          </div>
        </div>
        <div class="mag-filter-group">
          <span class="mag-filter-label">Формат</span>
          <div class="mag-chip-row" id="filter-format" data-key="format">
            <button class="mag-chip active" data-value="">Всі</button>
            ${Object.entries(FORMAT_LABELS).map(([k, v]) =>
              `<button class="mag-chip" data-value="${k}">${v}</button>`
            ).join('')}
          </div>
        </div>
        <div class="mag-filter-group">
          <span class="mag-filter-label">Аудиторія</span>
          <div class="mag-chip-row" id="filter-demographic" data-key="demographic">
            <button class="mag-chip active" data-value="">Всі</button>
            ${Object.entries(DEMO_LABELS).map(([k, v]) =>
              `<button class="mag-chip" data-value="${k}">${v}</button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="mag-grid" id="mag-grid"></div>
    </div>
  `;
}

// ── Render grid ───────────────────────────────────────
function render() {
  const filtered = allMagazines.filter(m => {
    if (state.publisher    && m.publisher    !== state.publisher)    return false;
    if (state.format       && m.format       !== state.format)       return false;
    if (state.demographic  && m.demographic  !== state.demographic)  return false;
    return true;
  });

  const subtitle = document.getElementById('mag-subtitle');
  if (subtitle) subtitle.textContent = `${filtered.length} журналів · Актуальний розклад виходів`;

  const grid = document.getElementById('mag-grid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="mag-empty">
        <div class="mag-empty-title">Нічого не знайдено</div>
        <p class="mag-empty-text">Спробуйте скинути фільтри.</p>
      </div>`;
    return;
  }

  grid.replaceChildren(...filtered.map(createMagCard));
}

// ── Card factory ──────────────────────────────────────
function createMagCard(mag) {
  const pub    = PUBLISHER_META[mag.publisher] ?? { label: mag.publisher, color: '#5b8dee' };
  const format = FORMAT_LABELS[mag.demographic] ?? mag.format;
  const demo   = DEMO_LABELS[mag.demographic]   ?? mag.demographic;

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
          <span class="mag-badge mag-badge-format">${FORMAT_LABELS[mag.format] ?? mag.format}</span>
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
        <span class="mag-stat-val">${esc(String(mag.series_count))}</span>
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

// ── Events ────────────────────────────────────────────
function bindEvents() {
  ['publisher', 'format', 'demographic'].forEach(key => {
    document.getElementById(`filter-${key}`)?.addEventListener('click', e => {
      const btn = e.target.closest('.mag-chip');
      if (!btn) return;

      // Update active chip
      const row = e.currentTarget;
      row.querySelectorAll('.mag-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');

      state[key] = btn.dataset.value;
      render();
    });
  });
}

// ── Utils ─────────────────────────────────────────────
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => s.replace(/[&<>"']/g, c => ESC_MAP[c]);