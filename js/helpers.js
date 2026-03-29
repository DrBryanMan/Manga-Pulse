export const PUBLISHER_META = {
  shueisha:       { label: 'Shueisha',     color: '#e8453c' },
  kodansha:       { label: 'Kodansha',     color: '#5b8dee' },
  shogakukan:     { label: 'Shogakukan',   color: '#3ecf8e' },
  hakusensha:     { label: 'Hakusensha',   color: '#a78bfa' },
  'akita-shoten': { label: 'Akita Shoten', color: '#f0943e' },
  'square-enix':  { label: 'Square Enix',  color: '#e2a74a' },
};

export const DEMOGRAPHIC_LABELS = {
  shounen: 'Шьонен',
  shoujo:  'Шьоджьо',
  seinen:  'Сейнен',
  josei:   'Джьосей',
};

export const MAGAZINE_LABELS = {
  'wsj':          'WSJ',
  'sj-plus':      'SJ+',
  'morning':      'Morning',
  'young-animal': 'Young Animal',
};

export const MAGAZINE_PERIODICITY = {
  0.5:  { label: 'двічі на тиждень', days: 3.5, chipClass: 'chip-weekly' },
  1:    { label: 'щотижня', days: 7, chipClass: 'chip-weekly' },
  2: { label: 'через тиждень', days: 14, chipClass: 'chip-weekly' },
  4: { label: 'щомісяця', days: 30, chipClass: 'chip-weekly' },
};

export const LEGACY_FORMAT_LABELS = {
  weekly:   'Щотижня',
  biweekly: 'Раз на два тижні',
  monthly:  'Щомісяця',
  digital:  'Цифровий',
};

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ESC_MAP[char]);

export function formatUkDate(dateLike, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const date = toDate(dateLike);
  if (!date) return '';
  return date.toLocaleDateString('uk-UA', options);
}

export function parseIssueDate(dateLike) {
  return toDate(dateLike);
}

export function getPeriodicityMeta(format) {
  if (typeof format === 'number' || /^\d*\.?\d+$/.test(String(format))) {
    return MAGAZINE_PERIODICITY[Number(format)] ?? null;
  }

  const legacy = {
    weekly:   { label: 'щотижня', days: 7, chipClass: 'chip-weekly' },
    biweekly: { label: 'раз на два тижні', days: 14, chipClass: 'chip-weekly' },
    monthly:  { label: 'щомісяця', days: 30, chipClass: 'chip-weekly' },
    digital:  { label: 'цифровий реліз', days: 1, chipClass: 'chip-digital' },
  };

  return legacy[format] ?? null;
}

export function addDays(dateLike, days) {
  const date = toDate(dateLike);
  if (!date || !Number.isFinite(days)) return null;
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  return date;
}

export function getNextIssueDate(lastIssueDate, format, breaks = []) {
  const periodicity = getPeriodicityMeta(format);
  if (!periodicity?.days) return null;

  const breakSet = new Set(
    breaks
      .map(value => isoDate(value))
      .filter(Boolean),
  );

  let candidate = addDays(lastIssueDate, periodicity.days);
  while (candidate && breakSet.has(isoDate(candidate))) {
    candidate = addDays(candidate, periodicity.days);
  }

  return candidate;
}

export function isoDate(dateLike) {
  const date = toDate(dateLike);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function toDate(dateLike) {
  if (!dateLike) return null;
  const date = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}
