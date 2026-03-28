const fetchCache = {};
const fetchOnce  = url => (fetchCache[url] ??= fetch(url).then(r => r.json()));

// ── Per-series enrichment data ───────────────────────
const SERIES_META = {
  'one-piece':       { author: 'Еіїтіро Ода (尾田栄一郎)',         demographic: 'Shōnen', year: 1997, releaseDay: 'Неділя',      genres: ['Пригоди', 'Екшн', 'Комедія', 'Фентезі'], circulation: '530 000 000', publisher: 'Shueisha · 集英社', desc: 'Пригодницька манґа Еіїтіро Оди. Монкі Д. Луффі та його команда прагнуть знайти легендарний скарб «One Piece» і стати Повелителями піратів. Виходить у WSJ з 1997 року — найтиражніша манґа в історії.' },
  'chainsaw-man':    { author: 'Тацукі Фудзімото (藤本タツキ)',      demographic: 'Shōnen', year: 2018, releaseDay: "П'ятниця",   genres: ['Екшн', 'Темне фентезі', 'Жахи'], circulation: '20 000 000', publisher: 'Shueisha · 集英社', desc: 'Денджі — бідний мисливець на демонів, що зливається з пилкою-демоном Почіта. Серіал вражає непередбачуваним сюжетом, авторським стилем і темними темами.' },
  'jujutsu-kaisen':  { author: 'Ґеґе Акутамі (芥見下々)',           demographic: 'Shōnen', year: 2018, releaseDay: 'Неділя',      genres: ['Екшн', 'Надприродне', 'Темне фентезі'], circulation: '80 000 000', publisher: 'Shueisha · 集英社', desc: 'Юджі Іноске ковтає прокляте зерно і стає вмістилищем найсильнішого прокляття. Екшн, магія та трагічні долі в академії Дзюдзюцу.' },
  'dandadan':        { author: 'Юкіно Такеї (龍幸伸)',              demographic: 'Shōnen', year: 2021, releaseDay: 'Понеділок',   genres: ['Екшн', 'Комедія', 'Надприродне', 'Романтика'], circulation: '10 000 000', publisher: 'Shueisha · 集英社', desc: 'Момо Аяшіро вірить у НЛО, Кен Окарон — у духів. Разом вони виявляють, що обидва існують. Шалений мікс горору, романтики та комедії.' },
  'spy-x-family':    { author: 'Тацуя Ендо (遠藤達哉)',             demographic: 'Shōnen', year: 2019, releaseDay: 'Субота',      genres: ['Пригоди', 'Комедія', 'Шпигунський трилер'], circulation: '35 000 000', publisher: 'Shueisha · 集英社', desc: 'Агент Лойд Форджер формує фіктивну сім\'ю для таємної місії: усиновлює телепатку Аню та одружується з вбивцею Йор.' },
  'my-hero-academia':{ author: 'Кохей Хорікоші (堀越耕平)',          demographic: 'Shōnen', year: 2014, releaseDay: 'Неділя',      genres: ['Екшн', 'Супергерої', 'Шкільне'], circulation: '65 000 000', publisher: 'Shueisha · 集英社', desc: 'Ізуку Мідорія народився без здатностей у світі супергероїв, але отримує надсилу від найвеличнішого героя Усі Олмайта.' },
  'kaiju-no-8':      { author: 'Наоя Мацумото (松本直也)',           demographic: 'Shōnen', year: 2020, releaseDay: 'Четвер',      genres: ['Екшн', 'Sci-Fi', 'Монстри'], circulation: '12 000 000', publisher: 'Shueisha · 集英社', desc: 'Кафка Хібіно мріє про боротьбу з кайдзю, але сам стає кайдзю №8. Унікальна ситуація — бути ворогом власної мрії.' },
  'vinland-saga':    { author: 'Макото Юкімура (幸村誠)',            demographic: 'Seinen', year: 2005, releaseDay: 'Четвер',      genres: ['Пригоди', 'Самурайська манґа', 'Вікінги', 'Драма'], circulation: '8 000 000', publisher: 'Kodansha · 講談社', desc: 'Турфін — молодий вікінг, якому помста заважає знайти власний шлях. Епічна сага про дорослішання в добу вікінгів.' },
  'berserk':         { author: 'Кентаро Міура (三浦建太郎)',          demographic: 'Seinen', year: 1989, releaseDay: 'Нерегулярно', genres: ['Темне фентезі', 'Пригоди', 'Екшн', 'Жахи'], circulation: '50 000 000', publisher: 'Hakusensha · 白泉社', desc: 'Ґатс — Чорний мечник — шукає помсти після зради. Похмура епопея Кентаро Міури вважається одним з найвизначніших творів манґи.' },
  'vagabond':        { author: 'Такехіко Іноуе (井上雄彦)',           demographic: 'Seinen', year: 1998, releaseDay: 'Нерегулярно', genres: ['Бойовик', 'Самурайська манґа', 'Драма', 'Філософія'], circulation: '82 000 000', publisher: 'Kodansha · 講談社', desc: 'Міямото Мусаші шукає просвітлення через бій. Однак справжня сила — не в мечі, а в душі. Графічний шедевр Такехіко Іноуе.' },
  'demon-slayer':    { author: 'Кою Ґотоґе (吾峠呼世晴)',             demographic: 'Shōnen', year: 2016, releaseDay: 'Завершено',  genres: ['Екшн', 'Надприродне', 'Бойовик'], circulation: '150 000 000', publisher: 'Shueisha · 集英社', desc: 'Таньджіро Камадо вступає до Корпусу Вбивць Демонів, щоб врятувати сестру Незуко, яку перетворили на демона.' },
  'sakamoto-days':   { author: 'Юто Судзукі (鈴木祐斗)',             demographic: 'Shōnen', year: 2020, releaseDay: 'Неділя',      genres: ['Екшн', 'Комедія', 'Бойовик'], circulation: '11 000 000', publisher: 'Shueisha · 集英社', desc: 'Колишній кілер №1 Тару Сакамото кинув ремесло заради сім\'ї та магазину. Але минуле завжди повертається.' },
};

const MAGAZINE_META = {
  'wsj':          { label: 'Weekly Shōnen Jump', dotClass: 'dot-wsj',       href: '#/magazines/wsj'          },
  'sj-plus':      { label: 'Shōnen Jump+',       dotClass: 'dot-sjplus',    href: '#/magazines/sj-plus'      },
  'morning':      { label: 'Weekly Morning',     dotClass: 'dot-morning',   href: '#/magazines/morning'      },
  'young-animal': { label: 'Young Animal',       dotClass: 'dot-ya',        href: '#/magazines/young-animal' },
  'wss':          { label: 'Weekly Shōnen Sunday', dotClass: 'dot-wss',     href: '#/magazines/wss'          },
  'wsm':          { label: 'Weekly Shōnen Magazine', dotClass: 'dot-wsm',   href: '#/magazines/wsm'          },
  'afternoon':    { label: 'Monthly Afternoon',  dotClass: 'dot-afternoon', href: '#/magazines/afternoon'    },
};

const STATUS_CHIPS = {
  active: { label: 'Видається',  cls: 'chip-ongoing' },
  hiatus: { label: 'Хіатус',     cls: 'chip-hiatus'  },
  done:   { label: 'Завершено',  cls: 'chip-done'    },
};

// ── Entry point ──────────────────────────────────────
export async function renderSeriesDetail(container, { id }) {
  container.innerHTML = `<div class="container page-body">
    <div class="series-hero"><div style="padding:60px;color:var(--text-muted)">Завантаження…</div></div>
  </div>`;

  const all    = await fetchOnce('./data/series.json');
  const series = all.find(s => s.id === id);

  if (!series) {
    container.innerHTML = `<div class="container page-body"><p style="color:var(--text-muted)">Серію не знайдено.</p></div>`;
    return;
  }

  const meta     = SERIES_META[id] ?? {};
  const mag      = MAGAZINE_META[series.magazine_slug] ?? { label: series.magazine_slug, dotClass: '', href: '#/magazines/' + series.magazine_slug };
  const status   = STATUS_CHIPS[series.status] ?? { label: series.status, cls: '' };
  const chapters = buildChapters(series.chapter);

  container.innerHTML = buildDetailHTML(series, meta, mag, status, chapters);

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(container, btn.dataset.tab));
  });
}

// ── Chapter list generator ───────────────────────────
const CHAPTER_TITLES = [
  'Нова арка', 'Легенди не помирають', 'Серце воїна',
  'Зіткнення на вершині', 'Межа сили', 'Шлях до вершини',
  'Останній союзник', 'Тінь минулого', 'Попереду — безодня',
  'Пробудження', 'Фінальний бій', 'Повернення додому',
];

function buildChapters(latest, count = 7) {
  const base = new Date('2026-03-27');
  return Array.from({ length: Math.min(latest, count) }, (_, i) => {
    const date = new Date(base);
    date.setDate(date.getDate() - i * 7);
    return {
      num:   latest - i,
      pages: 16 + ((latest - i) % 11),
      date,
      isNew: i === 0,
    };
  });
}

// ── HTML builders ────────────────────────────────────
function buildDetailHTML(s, meta, mag, status, chapters) {
  return `
    <div class="container page-body">
      <a class="back-btn" href="#/series">← Назад до серій</a>

      <div class="series-hero">
        <div class="series-hero-bg" style="background-image:url('${s.poster}')"></div>
        <img class="series-cover" src="${s.poster}" alt="${esc(s.title)} cover" loading="lazy">
        <div class="series-meta">
          <div class="series-name">${esc(s.title)}</div>
          ${s.title_ua ? `<div class="series-orig">${esc(s.title_ua)}</div>` : ''}
          <div class="series-tags">
            ${buildMagChip(mag)}
            <span class="chip ${status.cls}">${status.label}</span>
            ${meta.demographic ? `<span class="chip chip-shounen">${esc(meta.demographic)}</span>` : ''}
          </div>
          ${meta.desc ? `<div class="series-desc">${esc(meta.desc)}</div>` : ''}
          <div class="series-stats-row">
            ${buildStat(s.chapter.toLocaleString('uk-UA'), 'Розділів')}
            ${buildStat(`★ ${s.score.toFixed(2)}`, 'Рейтинг MAL', 'gold')}
            ${meta.year ? buildStat(String(meta.year), 'Рік початку') : ''}
            ${meta.releaseDay ? buildStat(meta.releaseDay, 'День виходу', 'green') : ''}
          </div>
        </div>
      </div>

      <div class="tabs">
        <div class="tab-list">
          <button class="tab-btn active" data-tab="chapters">Розділи</button>
          <button class="tab-btn" data-tab="schedule">Розклад</button>
          <button class="tab-btn" data-tab="about">Про серію</button>
        </div>

        <div class="tab-panel active" id="tab-chapters">
          ${buildChaptersPanel(s, chapters)}
        </div>

        <div class="tab-panel" id="tab-schedule">
          ${buildSchedulePanel(s, meta, mag)}
        </div>

        <div class="tab-panel" id="tab-about">
          ${buildAboutPanel(s, meta)}
        </div>
      </div>
    </div>
  `;
}

function buildMagChip({ label, dotClass, href }) {
  return `<a class="mag-chip" href="${esc(href)}">
    <span class="mag-dot ${dotClass}"></span>${esc(label)}
  </a>`;
}

function buildStat(val, lbl, cls = '') {
  return `<div class="series-stat">
    <span class="series-stat-val ${cls}">${esc(String(val))}</span>
    <span class="series-stat-lbl">${esc(lbl)}</span>
  </div>`;
}

function buildChaptersPanel(s, chapters) {
  const rows = chapters.map(ch => `
    <a class="chapter-row${ch.isNew ? ' latest' : ''}" href="#">
      <div class="ch-num${ch.isNew ? ' new' : ''}">${ch.num}</div>
      <div class="ch-title">${esc(CHAPTER_TITLES[ch.num % CHAPTER_TITLES.length])}</div>
      <div class="ch-pages">${ch.pages} стор.</div>
      <div class="ch-date">${ch.date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
      ${ch.isNew ? '<span class="chip chip-new">Новий</span>' : '<span></span>'}
    </a>`).join('');

  const remaining = s.chapter - chapters.length;
  return `
    <div class="chapters-table">${rows}</div>
    ${remaining > 0 ? `<a href="#" class="back-btn" style="margin-top:14px;display:inline-flex;border-style:dashed;margin-bottom:0">
      Завантажити ще ${remaining.toLocaleString('uk-UA')} розділів ↓
    </a>` : ''}
  `;
}

function buildSchedulePanel(s, meta, mag) {
  const nextDate = s.next_chapter_date && s.status === 'active'
    ? formatDate(s.next_chapter_date)
    : null;

  return `
    <div class="sched-card">
      <div class="sched-lbl">Поточний журнал</div>
      ${buildMagChip(mag)}
    </div>
    <div class="sched-card">
      <div class="sched-lbl">Типовий день виходу</div>
      ${buildDayPills(meta.releaseDay)}
    </div>
    ${nextDate ? `
    <div class="sched-card">
      <div class="sched-lbl">Наступний вихід</div>
      <div style="font-size:20px;font-weight:700;color:var(--text);font-family:var(--font-head)">${nextDate}</div>
      <div style="font-size:13px;color:var(--text-2);margin-top:6px">Розділ ${s.chapter + 1} · ${esc(mag.label)}</div>
    </div>` : ''}
  `;
}

function buildAboutPanel(s, meta) {
  const row = (lbl, content) => `
    <div class="sched-card">
      <div class="sched-lbl">${esc(lbl)}</div>
      ${content}
    </div>`;

  return [
    meta.author      ? row('Автор / Мангака',  `<div style="font-weight:600;font-size:15px">${esc(meta.author)}</div>`) : '',
    meta.publisher   ? row('Видавець',          `<div style="font-weight:600">${esc(meta.publisher)}</div>`) : '',
    meta.demographic ? row('Демографія',        `<span class="chip chip-shounen">${esc(meta.demographic)}</span>`) : '',
    meta.genres?.length ? row('Жанри', `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
        ${meta.genres.map(g => `<span class="chip chip-genre">${esc(g)}</span>`).join('')}
      </div>`) : '',
    meta.circulation ? row('Тираж', `
      <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--accent)">${esc(meta.circulation)}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">примірників</div>`) : '',
  ].join('');
}

// ── Tab switching ────────────────────────────────────
function activateTab(container, tabId) {
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  container.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));
}

// ── Helpers ──────────────────────────────────────────
const DAYS_UK = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_MAP  = { 'Понеділок': 1, 'Вівторок': 2, 'Середа': 3, 'Четвер': 4, "П'ятниця": 5, 'Субота': 6, 'Неділя': 0 };

function buildDayPills(releaseDay) {
  const active = DAY_MAP[releaseDay] ?? -1;
  return `<div class="day-pills">
    ${DAYS_UK.map((d, i) => `<span class="day-pill${i === active ? ' active' : ''}">${d}</span>`).join('')}
  </div>`;
}

function formatDate(str) {
  if (!str || str === 'today') return new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC_MAP[c]);