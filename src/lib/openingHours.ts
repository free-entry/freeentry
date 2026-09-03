/**
 * Renders the restricted OSM opening_hours subset stored in
 * Museum.openingHours ("Tu-Su 10:00-18:00; PH off") in the viewer's
 * language, using Intl for weekday and month names. Strings the grammar
 * doesn't cover fall back to the raw value rather than throwing.
 */

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// 2024-01-01 is a Monday; 2024 month indexes line up with MONTHS.
const DAY_REF = (i: number) => new Date(Date.UTC(2024, 0, 1 + i));
const MONTH_REF = (i: number) => new Date(Date.UTC(2024, i, 15));

export interface HoursLabels {
  closed: string;
  publicHolidays: string;
  always: string;
}

function dayName(locale: string, day: string): string {
  const i = DAYS.indexOf(day as (typeof DAYS)[number]);
  if (i === -1) return day;
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(DAY_REF(i));
}

function monthName(locale: string, month: string): string {
  const i = MONTHS.indexOf(month as (typeof MONTHS)[number]);
  if (i === -1) return month;
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(MONTH_REF(i));
}

const DAY_TOKEN = /^(Mo|Tu|We|Th|Fr|Sa|Su)((-|,)(Mo|Tu|We|Th|Fr|Sa|Su))*$/;
const MONTH_PART = `(${MONTHS.join('|')})(-(${MONTHS.join('|')}))?`;
const MONTH_TOKEN = new RegExp(`^${MONTH_PART}(,${MONTH_PART})*$`);
const TIME_TOKEN = /^\d{2}:\d{2}-\d{2}:\d{2}(,\d{2}:\d{2}-\d{2}:\d{2})*$/;

export interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

const SCHEMA_DAY: Record<(typeof DAYS)[number], string> = {
  Mo: 'https://schema.org/Monday',
  Tu: 'https://schema.org/Tuesday',
  We: 'https://schema.org/Wednesday',
  Th: 'https://schema.org/Thursday',
  Fr: 'https://schema.org/Friday',
  Sa: 'https://schema.org/Saturday',
  Su: 'https://schema.org/Sunday',
};

function expandDayRange(start: (typeof DAYS)[number], end: (typeof DAYS)[number]): string[] {
  const result: string[] = [];
  let index = DAYS.indexOf(start);
  const endIndex = DAYS.indexOf(end);
  for (let count = 0; count < DAYS.length; count++) {
    result.push(SCHEMA_DAY[DAYS[index]]);
    if (index === endIndex) return result;
    index = (index + 1) % DAYS.length;
  }
  return result;
}

function parseDays(spec: string): string[] | null {
  if (!DAY_TOKEN.test(spec)) return null;
  const days: string[] = [];
  for (const part of spec.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-') as [(typeof DAYS)[number], (typeof DAYS)[number]];
      days.push(...expandDayRange(start, end));
    } else {
      days.push(SCHEMA_DAY[part as (typeof DAYS)[number]]);
    }
  }
  return [...new Set(days)];
}

/** Convert the supported opening_hours subset into Schema.org specifications. */
export function parseOpeningHours(raw: string): OpeningHoursSpecification[] | null {
  const rules = raw.split(';').map((rule) => rule.trim()).filter(Boolean);
  if (rules.length === 0) return null;

  const specifications: OpeningHoursSpecification[] = [];
  for (const rule of rules) {
    if (rule === '24/7') {
      specifications.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAYS.map((day) => SCHEMA_DAY[day]),
        opens: '00:00',
        closes: '23:59',
      });
      continue;
    }

    const tokens = rule.split(/\s+/);
    if (tokens.some((token) => MONTH_TOKEN.test(token))) return null;
    if (tokens.includes('PH') || tokens.includes('off')) continue;
    if (tokens.length !== 2 || !DAY_TOKEN.test(tokens[0]) || !TIME_TOKEN.test(tokens[1])) {
      return null;
    }

    const dayOfWeek = parseDays(tokens[0]);
    if (!dayOfWeek) return null;
    for (const range of tokens[1].split(',')) {
      const [opens, closes] = range.split('-');
      specifications.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek,
        opens,
        closes,
      });
    }
  }

  return specifications;
}

function renderDays(locale: string, spec: string, labels: HoursLabels): string {
  if (spec === 'PH') return labels.publicHolidays;
  return spec
    .split(',')
    .map((part) =>
      part.includes('-')
        ? part.split('-').map((d) => dayName(locale, d)).join('–')
        : dayName(locale, part),
    )
    .join(', ');
}

function renderMonths(locale: string, spec: string): string {
  return spec
    .split(',')
    .map((part) =>
      part.includes('-')
        ? part.split('-').map((m) => monthName(locale, m)).join('–')
        : monthName(locale, part),
    )
    .join(', ');
}

/** One ';'-separated rule → localized text, or null when unparseable. */
function renderRule(locale: string, rule: string, labels: HoursLabels): string | null {
  if (rule === '24/7') return labels.always;

  const tokens = rule.split(/\s+/);
  let months: string | null = null;
  let days: string | null = null;
  let times: string | null = null;
  let off = false;

  for (const token of tokens) {
    if (MONTH_TOKEN.test(token) && months === null && days === null) {
      months = renderMonths(locale, token);
    } else if ((DAY_TOKEN.test(token) || token === 'PH') && days === null && times === null) {
      days = renderDays(locale, token, labels);
    } else if (TIME_TOKEN.test(token) && times === null) {
      times = token.replace(/,/g, ', ');
    } else if (token === 'off' && !off) {
      off = true;
    } else {
      return null;
    }
  }

  const subject = [months, days].filter(Boolean).join(' ');
  if (off) return subject ? `${subject} ${labels.closed}` : labels.closed;
  if (!times) return null;
  return subject ? `${subject} ${times}` : times;
}

export function formatOpeningHours(raw: string, locale: string, labels: HoursLabels): string {
  const rules = raw.split(';').map((r) => r.trim()).filter(Boolean);
  const rendered = rules.map((r) => renderRule(locale, r, labels));
  // One unparseable rule falls the whole string back to raw — half-translated
  // hours would be harder to read than the original.
  if (rendered.some((r) => r === null)) return raw;
  return rendered.join(' · ');
}
