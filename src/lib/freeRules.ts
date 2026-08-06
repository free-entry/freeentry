import type { EventDates, EventKey, FreeRule, Museum, Weekday } from './types';

export interface RuleContext {
  events: EventDates;
  /** Visitor qualifies for under-26 (EU resident) free admission. */
  under26: boolean;
}

export interface EventDateInfo {
  dates: string[];
  /** True when no confirmed dates exist for the year and a rule-of-thumb was used. */
  estimated: boolean;
}

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_MS = 86_400_000;

function toISO(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

function parseISO(date: string): { y: number; m: number; d: number; utcMs: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d, utcMs: Date.UTC(y, m - 1, d) };
}

/** ISO date of the nth <weekday> of a month (month is 1-based; -1 = last). */
export function nthWeekdayOfMonth(year: number, month: number, nth: number, weekday: Weekday): string {
  if (nth === -1) {
    const lastDay = new Date(Date.UTC(year, month, 0));
    const back = (lastDay.getUTCDay() - WEEKDAY_INDEX[weekday] + 7) % 7;
    return toISO(Date.UTC(year, month - 1, lastDay.getUTCDate() - back));
  }
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (WEEKDAY_INDEX[weekday] - firstDow + 7) % 7;
  return toISO(Date.UTC(year, month - 1, 1 + offset + (nth - 1) * 7));
}

/**
 * Dates of a variable-date event for a year: confirmed from data/events.json
 * when available, otherwise estimated (museum night ≈ 3rd Saturday of May,
 * heritage days ≈ 3rd Saturday of September + the following Sunday).
 */
export function eventDatesForYear(events: EventDates, event: EventKey, year: number): EventDateInfo {
  const confirmed = events[event]?.confirmed[String(year)];
  if (confirmed && confirmed.length > 0) {
    return { dates: confirmed, estimated: false };
  }
  if (event === 'museum-night') {
    return { dates: [nthWeekdayOfMonth(year, 5, 3, 'saturday')], estimated: true };
  }
  const saturday = nthWeekdayOfMonth(year, 9, 3, 'saturday');
  return { dates: [saturday, toISO(parseISO(saturday).utcMs + DAY_MS)], estimated: true };
}

/** Whether a rule grants free entry on the given ISO date. */
export function ruleActiveOn(rule: FreeRule, date: string, ctx: RuleContext): boolean {
  const audience = rule.audience ?? 'everyone';
  if (audience !== 'everyone' && !ctx.under26) return false;

  switch (rule.kind) {
    case 'always':
      return true;
    case 'nth-weekday': {
      const { y, m } = parseISO(date);
      if (rule.months && !rule.months.includes(m)) return false;
      return nthWeekdayOfMonth(y, m, rule.nth ?? 1, rule.weekday ?? 'sunday') === date;
    }
    case 'annual-date':
      return date.slice(5) === rule.date;
    case 'event': {
      if (!rule.event) return false;
      const { y } = parseISO(date);
      return eventDatesForYear(ctx.events, rule.event, y).dates.includes(date);
    }
  }
}

/** Whether an event rule would rely on estimated dates for the given year. */
function ruleEstimatedForYear(rule: FreeRule, year: number, ctx: RuleContext): boolean {
  if (rule.kind !== 'event' || !rule.event) return false;
  return eventDatesForYear(ctx.events, rule.event, year).estimated;
}

export function isFreeOn(museum: Museum, date: string, ctx: RuleContext): boolean {
  return museum.freeAccess.some((rule) => ruleActiveOn(rule, date, ctx));
}

/** Number of museums free on each day of a month (keys are ISO dates). */
export function freeCountByDay(
  museums: Museum[],
  year: number,
  month: number,
  ctx: RuleContext,
): Map<string, number> {
  const counts = new Map<string, number>();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = toISO(Date.UTC(year, month - 1, day));
    counts.set(date, museums.reduce((n, m) => n + (isFreeOn(m, date, ctx) ? 1 : 0), 0));
  }
  return counts;
}

const NEXT_FREE_HORIZON_DAYS = 730;

/**
 * First date ≥ `from` on which the museum is free, with the rule that grants
 * it. Scans day by day; the horizon covers every rule kind's period.
 */
export function nextFreeDate(
  museum: Museum,
  from: string,
  ctx: RuleContext,
): { date: string; rule: FreeRule; estimated: boolean } | null {
  if (museum.freeAccess.length === 0) return null;
  const start = parseISO(from).utcMs;
  for (let i = 0; i <= NEXT_FREE_HORIZON_DAYS; i++) {
    const date = toISO(start + i * DAY_MS);
    for (const rule of museum.freeAccess) {
      if (ruleActiveOn(rule, date, ctx)) {
        return { date, rule, estimated: ruleEstimatedForYear(rule, parseISO(date).y, ctx) };
      }
    }
  }
  return null;
}
