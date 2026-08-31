import { describe, expect, it } from 'vitest';
import type { EventDates, FreeRule, Museum } from '@/lib/types';
import { freeCountByDay } from '@/lib/freeRules';

const SOURCE = { url: 'https://example.org', checkedAt: '2026-08-06' };
const EVENTS: EventDates = {
  'museum-night': { confirmed: { '2026': ['2026-05-16'] } },
  'heritage-days': { confirmed: { '2026': ['2026-09-19', '2026-09-20'] } },
};
const ctx = { events: EVENTS, audiences: [] };

function museum(id: string, rules: FreeRule[]): Museum {
  return {
    id,
    name: id,
    coordinates: [2.35, 48.85],
    address: 'x',
    postalCode: '75001',
    commune: 'Paris',
    department: '75',
    tags: [],
    freeAccess: rules,
  };
}

const MUSEUMS = [
  museum('always', [{ kind: 'always', source: SOURCE }]),
  museum('sunday', [{ kind: 'nth-weekday', nth: 1, weekday: 'sunday', source: SOURCE }]),
  museum('jep', [{ kind: 'event', event: 'heritage-days', source: SOURCE }]),
];

describe('freeCountByDay', () => {
  it('counts free museums for each day of September 2026', () => {
    const counts = freeCountByDay(MUSEUMS, 2026, 9, ctx);
    expect(counts.get('2026-09-01')).toBe(1); // always only
    expect(counts.get('2026-09-06')).toBe(2); // always + first Sunday
    expect(counts.get('2026-09-19')).toBe(2); // always + heritage days
    expect(counts.get('2026-09-20')).toBe(2);
    expect(counts.get('2026-09-30')).toBe(1);
    expect(counts.size).toBe(30);
  });
});
