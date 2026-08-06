import { describe, expect, it } from 'vitest';
import type { EventDates, FreeRule, Museum } from '@/lib/types';
import {
  eventDatesForYear,
  isFreeOn,
  nextFreeDate,
  nthWeekdayOfMonth,
  ruleActiveOn,
} from '@/lib/freeRules';

const SOURCE = { url: 'https://example.org', checkedAt: '2026-08-06' };

const EVENTS: EventDates = {
  'museum-night': { confirmed: { '2026': ['2026-05-16'] } },
  'heritage-days': { confirmed: { '2026': ['2026-09-19', '2026-09-20'] } },
};

const ctx = { events: EVENTS, under26: false };
const ctxUnder26 = { events: EVENTS, under26: true };

function museum(rules: FreeRule[]): Museum {
  return {
    id: 'test-museum',
    name: 'Musée Test',
    coordinates: [2.35, 48.85],
    address: '1 rue de Test',
    postalCode: '75001',
    commune: 'Paris',
    arrondissement: 1,
    department: '75',
    tags: [],
    freeAccess: rules,
  };
}

describe('nthWeekdayOfMonth', () => {
  it('finds the first Sunday of September 2026', () => {
    expect(nthWeekdayOfMonth(2026, 9, 1, 'sunday')).toBe('2026-09-06');
  });
  it('finds the first Sunday of August 2026', () => {
    expect(nthWeekdayOfMonth(2026, 8, 1, 'sunday')).toBe('2026-08-02');
  });
  it('handles months whose first day is the target weekday', () => {
    expect(nthWeekdayOfMonth(2026, 11, 1, 'sunday')).toBe('2026-11-01');
  });
  it('finds the first Saturday of October 2026', () => {
    expect(nthWeekdayOfMonth(2026, 10, 1, 'saturday')).toBe('2026-10-03');
  });
  it('finds the LAST Sunday of a month with nth -1', () => {
    expect(nthWeekdayOfMonth(2026, 8, -1, 'sunday')).toBe('2026-08-30');
    expect(nthWeekdayOfMonth(2026, 5, -1, 'sunday')).toBe('2026-05-31'); // last day is a Sunday
  });
});

describe('ruleActiveOn — nth-weekday', () => {
  const firstSunday: FreeRule = { kind: 'nth-weekday', nth: 1, weekday: 'sunday', source: SOURCE };
  it('is active on the first Sunday', () => {
    expect(ruleActiveOn(firstSunday, '2026-09-06', ctx)).toBe(true);
  });
  it('is inactive on other Sundays and weekdays', () => {
    expect(ruleActiveOn(firstSunday, '2026-09-13', ctx)).toBe(false);
    expect(ruleActiveOn(firstSunday, '2026-09-07', ctx)).toBe(false);
  });
  it('respects a low-season months window (Nov–Mar)', () => {
    const lowSeason: FreeRule = { ...firstSunday, months: [11, 12, 1, 2, 3] };
    expect(ruleActiveOn(lowSeason, '2026-11-01', ctx)).toBe(true);
    expect(ruleActiveOn(lowSeason, '2026-10-04', ctx)).toBe(false);
  });
  it('respects a first-Saturday Oct–Jun window', () => {
    const firstSaturday: FreeRule = {
      kind: 'nth-weekday',
      nth: 1,
      weekday: 'saturday',
      months: [10, 11, 12, 1, 2, 3, 4, 5, 6],
      source: SOURCE,
    };
    expect(ruleActiveOn(firstSaturday, '2026-10-03', ctx)).toBe(true);
    expect(ruleActiveOn(firstSaturday, '2026-07-04', ctx)).toBe(false);
  });
});

describe('ruleActiveOn — annual-date and always', () => {
  it('annual-date 07-14 matches only July 14', () => {
    const rule: FreeRule = { kind: 'annual-date', date: '07-14', source: SOURCE };
    expect(ruleActiveOn(rule, '2026-07-14', ctx)).toBe(true);
    expect(ruleActiveOn(rule, '2026-07-15', ctx)).toBe(false);
  });
  it('always matches any date', () => {
    const rule: FreeRule = { kind: 'always', source: SOURCE };
    expect(ruleActiveOn(rule, '2026-01-01', ctx)).toBe(true);
    expect(ruleActiveOn(rule, '2027-12-31', ctx)).toBe(true);
  });
});

describe('eventDatesForYear', () => {
  it('returns confirmed dates when present', () => {
    expect(eventDatesForYear(EVENTS, 'museum-night', 2026)).toEqual({
      dates: ['2026-05-16'],
      estimated: false,
    });
  });
  it('estimates museum night as the 3rd Saturday of May', () => {
    expect(eventDatesForYear(EVENTS, 'museum-night', 2027)).toEqual({
      dates: ['2027-05-15'],
      estimated: true,
    });
  });
  it('estimates heritage days as the 3rd Saturday of September + Sunday', () => {
    expect(eventDatesForYear(EVENTS, 'heritage-days', 2027)).toEqual({
      dates: ['2027-09-18', '2027-09-19'],
      estimated: true,
    });
  });
  it('activates event rules on confirmed dates', () => {
    const rule: FreeRule = { kind: 'event', event: 'heritage-days', source: SOURCE };
    expect(ruleActiveOn(rule, '2026-09-19', ctx)).toBe(true);
    expect(ruleActiveOn(rule, '2026-09-21', ctx)).toBe(false);
  });
});

describe('audience gating', () => {
  const rule: FreeRule = { kind: 'always', audience: 'under-26-eu', source: SOURCE };
  it('is inactive for the general audience', () => {
    expect(ruleActiveOn(rule, '2026-08-06', ctx)).toBe(false);
  });
  it('is active when the visitor is under 26', () => {
    expect(ruleActiveOn(rule, '2026-08-06', ctxUnder26)).toBe(true);
  });
});

describe('isFreeOn / nextFreeDate', () => {
  const firstSundayMuseum = museum([
    { kind: 'nth-weekday', nth: 1, weekday: 'sunday', source: SOURCE },
  ]);
  it('isFreeOn matches any active rule', () => {
    expect(isFreeOn(firstSundayMuseum, '2026-09-06', ctx)).toBe(true);
    expect(isFreeOn(firstSundayMuseum, '2026-09-05', ctx)).toBe(false);
  });
  it('nextFreeDate skips a passed first Sunday', () => {
    expect(nextFreeDate(firstSundayMuseum, '2026-08-06', ctx)?.date).toBe('2026-09-06');
  });
  it('nextFreeDate includes the from date itself', () => {
    expect(nextFreeDate(firstSundayMuseum, '2026-08-01', ctx)?.date).toBe('2026-08-02');
  });
  it('nextFreeDate returns null when a museum is never free', () => {
    expect(nextFreeDate(museum([]), '2026-08-06', ctx)).toBeNull();
  });
  it('nextFreeDate flags estimated event dates', () => {
    const eventMuseum = museum([{ kind: 'event', event: 'museum-night', source: SOURCE }]);
    const next = nextFreeDate(eventMuseum, '2026-06-01', ctx);
    expect(next?.date).toBe('2027-05-15');
    expect(next?.estimated).toBe(true);
  });
});

describe('weekly and residents rules', () => {
  const ctx = { events: { 'museum-night': { confirmed: {} }, 'heritage-days': { confirmed: {} } }, under26: false } as never;
  it('weekly rule fires on its weekday only', () => {
    const rule = { kind: 'weekly', weekday: 'thursday', source: { url: 'https://x', checkedAt: '2026-08-06' } } as never;
    expect(ruleActiveOn(rule, '2026-08-06', ctx)).toBe(true); // Thursday
    expect(ruleActiveOn(rule, '2026-08-07', ctx)).toBe(false);
  });
  it('residents-only rules never count as free for the visitor', () => {
    const rule = { kind: 'nth-weekday', nth: 1, weekday: 'sunday', audience: 'residents', source: { url: 'https://x', checkedAt: '2026-08-06' } } as never;
    expect(ruleActiveOn(rule, '2026-08-02', ctx)).toBe(false);
  });
});

