import { describe, expect, it } from 'vitest';
import type { FreeRule, Museum } from '@/lib/types';
import { CATEGORY_COLORS, CATEGORY_ORDER, deriveCategories, deriveCategory } from '@/lib/categories';

const SOURCE = { url: 'https://example.org', checkedAt: '2026-08-06' };

function museum(rules: FreeRule[]): Museum {
  return {
    id: 'test',
    name: 'Test',
    coordinates: [2.35, 48.85],
    address: 'x',
    postalCode: '75001',
    commune: 'Paris',
    department: '75',
    tags: [],
    freeAccess: rules,
  };
}

const always: FreeRule = { kind: 'always', source: SOURCE };
const firstSunday: FreeRule = { kind: 'nth-weekday', nth: 1, weekday: 'sunday', source: SOURCE };

describe('deriveCategory', () => {
  it('always wins over first-sunday', () => {
    expect(deriveCategory(museum([always, firstSunday]))).toBe('always');
  });
  it('classifies 14 July as its own category', () => {
    expect(deriveCategory(museum([{ kind: 'annual-date', date: '07-14', source: SOURCE }]))).toBe(
      'july-14',
    );
  });
  it('derives every category a rule set covers, in precedence order', () => {
    const louvre = museum([
      { kind: 'nth-weekday', nth: 1, weekday: 'friday', evening: true, source: SOURCE },
      { kind: 'annual-date', date: '07-14', source: SOURCE },
      { kind: 'always', audience: 'under-26-eu', source: SOURCE },
    ]);
    expect(deriveCategories(louvre)).toEqual(['nocturne', 'july-14', 'under-26-only']);
    expect(deriveCategory(louvre)).toBe('nocturne');
    expect(deriveCategories(museum([]))).toEqual(['none']);
  });
  it('classifies plain first-sunday', () => {
    expect(deriveCategory(museum([firstSunday]))).toBe('first-sunday');
  });
  it('classifies booking-required first-sunday', () => {
    expect(deriveCategory(museum([{ ...firstSunday, reservationRequired: true }]))).toBe(
      'first-sunday-booking',
    );
  });
  it('classifies low-season first-sunday', () => {
    expect(deriveCategory(museum([{ ...firstSunday, months: [11, 12, 1, 2, 3] }]))).toBe(
      'first-sunday-low-season',
    );
  });
  it('classifies first-saturday', () => {
    expect(
      deriveCategory(
        museum([{ kind: 'nth-weekday', nth: 1, weekday: 'saturday', months: [10, 11], source: SOURCE }]),
      ),
    ).toBe('first-saturday');
  });
  it('classifies evening rules as nocturne, even on Saturdays', () => {
    expect(
      deriveCategory(
        museum([{ kind: 'nth-weekday', nth: 1, weekday: 'saturday', evening: true, source: SOURCE }]),
      ),
    ).toBe('nocturne');
  });
  it('classifies event/other-annual-date only museums as special-days', () => {
    expect(
      deriveCategory(
        museum([
          { kind: 'annual-date', date: '05-08', source: SOURCE },
          { kind: 'event', event: 'heritage-days', source: SOURCE },
        ]),
      ),
    ).toBe('special-days');
  });
  it('classifies under-26-only museums', () => {
    expect(deriveCategory(museum([{ ...always, audience: 'under-26-eu' }]))).toBe('under-26-only');
  });
  it('classifies museums without rules as none', () => {
    expect(deriveCategory(museum([]))).toBe('none');
  });
});

describe('category metadata', () => {
  it('orders and colors every category', () => {
    expect(CATEGORY_ORDER).toHaveLength(14);
    for (const c of CATEGORY_ORDER) {
      expect(CATEGORY_COLORS[c]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
