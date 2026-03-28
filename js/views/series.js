import { createMangaCard } from '../components/manga-card.js';

// Module-level cache so data survives re-renders on repeated navigation
let allSeries  = [];
let magazines  = [];

// Simple fetch-once cache keyed by URL
const fetchCache = {};
const fetchOnce = (url) => (fetchCache[url] ??= fetch(url).then(r => r.json()));

// ── Entry point ──────────────────────────────────────
export async function renderSeries(container) {
  container.innerHTML = buildSkeleton();

  [allSeries, magazines] = await Promise.all([
    fetchOnce('./data/series.json'),
    fetchOnce('./data/magazines.json'),
  ]);

  populateMagazineFilter();
  bindEvents();
  render();
}

// ── HTML skeleton ────────────────────────────────────
function buildSkeleton() {
  return `
    <div class="container page-body">
      <div class="page-header">
        <h1 class="page-title">Всі серії</h1>
      </div>

      <div class="filter-bar">
        <div class="filter-section results-section">
          <div>
            <div class="results-label">Серій</div>
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
            <input type="text" id="search-input" class="search-input"
              placeholder="Назва серії або журналу…" autocomplete="off">
          </div>
        </div>

        <div class="filter-section filters-section">
          <div class="select-wrap">
            <select id="filter-magazine" class="filter-select">
              <option value="">Всі журнали</option>
            </select>
          </div>
          <div class="select-wrap">
            <select id="filter-status" class="filter-select">
              <option value="">Будь-який статус</option>
              <option value="active">Активні</option>
              <option value="hiatus">Хіатус</option>
              <option value="done">Завершені</option>
            </select>
          </div>
          <div class="select-wrap">
            <select id="filter-sort" class="filter-select">
              <option value="score">За рейтингом</option>
              <option value="title">За назвою</option>
              <option value="chapter">За розділом</option>
            </select>
          </div>
        </div>
      </div>

      <div class="active-filters" id="active-filters"></div>
      <div class="manga-grid" id="manga-grid"></div>
    </div>
  `;
}

// ── Filter / sort ────────────────────────────────────
function getFilters() {
  return {
    q:        document.getElementById('search-input')?.value.trim().toLowerCase() ?? '',
    magazine: document.getElementById('filter-magazine')?.value ?? '',
    status:   document.getElementById('filter-status')?.value ?? '',
    sort:     document.getElementById('filter-sort')?.value ?? 'score',
  };
}

function applyFilters(series, { q, magazine, status, sort }) {
  const filtered = series.filter(s => {
    if (q && !s.title.toLowerCase().includes(q) && !s.title_ua?.toLowerCase().includes(q)) return false;
    if (magazine && s.magazine_slug !== magazine) return false;
    if (status  && s.status !== status)           return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (sort === 'title')   return a.title.localeCompare(b.title, 'uk');
    if (sort === 'chapter') return b.chapter - a.chapter;
    return b.score - a.score; // default: rating
  });
}

// ── Render ───────────────────────────────────────────
function render() {
    const filters  = getFilters();
    const filtered = applyFilters(allSeries, filters);

    const grid  = document.getElementById('manga-grid');
    const count = document.getElementById('results-number');
    if (!grid) return;

    count.textContent = filtered.length.toLocaleString('uk-UA');
    renderPills(filters);

    if (!filtered.length) {
        grid.innerHTML = `
        <div class="series-empty" style="grid-column:1/-1">
            <div class="series-empty-title">Нічого не знайдено</div>
            <p class="series-empty-text">Спробуйте змінити запит або скинути фільтри.</p>
        </div>
        `;
        return;
    }

    grid.replaceChildren(...filtered.map(createMangaCard));
}

const STATUS_LABELS = { active: 'Активні', hiatus: 'Хіатус', done: 'Завершені' };

function renderPills({ q, magazine, status }) {
  const container = document.getElementById('active-filters');
  if (!container) return;

  const pills = [];
  if (q)        pills.push(['search-input',    `🔍 ${q}`]);
  if (magazine) pills.push(['filter-magazine', getMagazineLabel(magazine)]);
  if (status)   pills.push(['filter-status',   STATUS_LABELS[status] ?? status]);

  container.replaceChildren(
    ...pills.map(([targetId, label]) => {
      const pill = document.createElement('button');
      pill.className = 'filter-pill';
      pill.innerHTML = `${esc(label)}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`;
      pill.addEventListener('click', () => {
        const el = document.getElementById(targetId);
        if (el) { el.value = ''; el.dispatchEvent(new Event('input')); }
        render();
      });
      return pill;
    })
  );
}

function getMagazineLabel(slug) {
  return magazines.find(m => m.slug === slug)?.label ?? slug;
}

// ── Populate selects ─────────────────────────────────
function populateMagazineFilter() {
  const sel = document.getElementById('filter-magazine');
  if (!sel) return;
  const frag = document.createDocumentFragment();
  magazines.forEach(({ slug, label }) => {
    const opt = document.createElement('option');
    opt.value = slug;
    opt.textContent = label;
    frag.appendChild(opt);
  });
  sel.appendChild(frag);
}

// ── Events ───────────────────────────────────────────
function bindEvents() {
  let timer;
  const debouncedRender = () => {
    clearTimeout(timer);
    timer = setTimeout(render, 180);
  };

  document.getElementById('search-input')?.addEventListener('input', debouncedRender);
  document.getElementById('filter-magazine')?.addEventListener('change', render);
  document.getElementById('filter-status')?.addEventListener('change', render);
  document.getElementById('filter-sort')?.addEventListener('change', render);
}