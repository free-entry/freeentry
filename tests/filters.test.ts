import { describe, expect, it } from 'vitest';
import type { EventDates, FreeRule, Museum } from '@/lib/types';
import { applyFilters, DEFAULT_FILTERS, type FilterState } from '@/lib/filters';

const SOURCE = { url: 'https://example.org', checkedAt: '2026-08-06' };
const EVENTS: EventDates = {
  'museum-night': { confirmed: { '2026': ['2026-05-16'] } },
  'heritage-days': { confirmed: { '2026': ['2026-09-19', '2026-09-20'] } },
};
const ctx = { events: EVENTS, under26: false };

function make(id: string, over: Partial<Museum>, rules: FreeRule[]): Museum {
  return {
    id,
    name: id,
    coordinates: [2.3522, 48.8566],
    address: 'x',
    postalCode: '75001',
    commune: 'Paris',
    arrondissement: 1,
    department: '75',
    tags: [],
    freeAccess: rules,
    ...over,
  };
}

const louvre = make('louvre', { name: 'Musée du Louvre' }, [
  { kind: 'nth-weekday', nth: 1, weekday: 'friday', evening: true, source: SOURCE },
  { kind: 'always', audience: 'under-26-eu', source: SOURCE },
]);
const carnavalet = make('carnavalet', { name: 'Musée Carnavalet', arrondissement: 3, postalCode: '75003' }, [
  { kind: 'always', source: SOURCE },
]);
const orsay = make('orsay', { name: "Musée d'Orsay", arrondissement: 7, postalCode: '75007' }, [
  { kind: 'nth-weekday', nth: 1, weekday: 'sunday', reservationRequired: true, source: SOURCE },
]);
const versailles = make(
  'versailles',
  {
    name: 'Château de Versailles',
    commune: 'Versailles',
    postalCode: '78000',
    department: '78',
    arrondissement: undefined,
    coordinates: [2.1204, 48.8049],
  },
  [{ kind: 'nth-weekday', nth: 1, weekday: 'sunday', months: [11, 12, 1, 2, 3], source: SOURCE }],
);
const paidMuseum = make('grevin', { name: 'Musée Grévin', arrondissement: 9, postalCode: '75009' }, []);

const ALL = [louvre, carnavalet, orsay, versailles, paidMuseum];

function f(over: Partial<FilterState>): FilterState {
  return { ...DEFAULT_FILTERS, ...over };
}

function ids(museums: Museum[]): string[] {
  return museums.map((m) => m.id).sort();
}

describe('applyFilters', () => {
  it('hides paid museums by default and shows them with includePaid', () => {
    expect(ids(applyFilters(ALL, f({}), ctx, {}))).toEqual([
      'carnavalet',
      'louvre',
      'orsay',
      'versailles',
    ]);
    expect(ids(applyFilters(ALL, f({ includePaid: true }), ctx, {}))).toContain('grevin');
  });

  it('filters by free type at rule level', () => {
    expect(ids(applyFilters(ALL, f({ types: ['always'] }), ctx, {}))).toEqual(['carnavalet']);
    expect(ids(applyFilters(ALL, f({ types: ['first-sunday-booking'] }), ctx, {}))).toEqual(['orsay']);
    expect(ids(applyFilters(ALL, f({ types: ['nocturne'] }), ctx, {}))).toEqual(['louvre']);
  });

  it('does not classify a booking-required first Sunday as plain first-sunday', () => {
    expect(ids(applyFilters(ALL, f({ types: ['first-sunday'] }), ctx, {}))).toEqual([]);
  });

  it('shows under-26-only museums via their chip even with the toggle off', () => {
    expect(ids(applyFilters(ALL, f({ types: ['under-26-only'] }), ctx, {}))).toEqual(['louvre']);
  });

  it('filters by date', () => {
    // 2026-11-01 is a first Sunday inside Versailles' Nov–Mar window.
    const nov = applyFilters(ALL, f({ date: '2026-11-01' }), ctx, {});
    expect(ids(nov)).toEqual(['carnavalet', 'orsay', 'versailles']);
    // 2026-10-04 is a first Sunday outside it.
    const oct = applyFilters(ALL, f({ date: '2026-10-04' }), ctx, {});
    expect(ids(oct)).toEqual(['carnavalet', 'orsay']);
  });

  it('combines date and type at rule level', () => {
    // Versailles' only matching rule is low-season; on a valid date it passes
    // with the low-season chip but NOT with the plain first-sunday chip.
    expect(
      ids(applyFilters(ALL, f({ date: '2026-11-01', types: ['first-sunday-low-season'] }), ctx, {})),
    ).toEqual(['versailles']);
    expect(
      ids(applyFilters(ALL, f({ date: '2026-11-01', types: ['first-sunday'] }), ctx, {})),
    ).toEqual([]);
  });

  it('under26 toggle activates audience rules for date filtering', () => {
    // On a random Tuesday only always-free museums (and the Louvre for
    // under-26 visitors) are free.
    expect(ids(applyFilters(ALL, f({ date: '2026-08-04' }), ctx, {}))).toEqual(['carnavalet']);
    expect(ids(applyFilters(ALL, f({ date: '2026-08-04', under26: true }), ctx, {}))).toEqual([
      'carnavalet',
      'louvre',
    ]);
  });

  it('filters by area with OR across sub-dimensions', () => {
    expect(ids(applyFilters(ALL, f({ departments: ['78'] }), ctx, {}))).toEqual(['versailles']);
    expect(ids(applyFilters(ALL, f({ arrondissements: [3, 7] }), ctx, {}))).toEqual([
      'carnavalet',
      'orsay',
    ]);
    expect(
      ids(applyFilters(ALL, f({ departments: ['78'], arrondissements: [3] }), ctx, {})),
    ).toEqual(['carnavalet', 'versailles']);
    expect(ids(applyFilters(ALL, f({ communes: ['Versailles'] }), ctx, {}))).toEqual(['versailles']);
  });

  it('filters by distance', () => {
    const center: [number, number] = [2.3522, 48.8566];
    expect(ids(applyFilters(ALL, f({ center, radiusKm: 5 }), ctx, {}))).toEqual([
      'carnavalet',
      'louvre',
      'orsay',
    ]);
    expect(ids(applyFilters(ALL, f({ center, radiusKm: 30 }), ctx, {}))).toContain('versailles');
  });

  it('searches names diacritic-insensitively including localized names', () => {
    expect(ids(applyFilters(ALL, f({ query: 'musee d orsay' }), ctx, {}))).toEqual(['orsay']);
    expect(ids(applyFilters(ALL, f({ query: 'chateau' }), ctx, {}))).toEqual(['versailles']);
    expect(ids(applyFilters(ALL, f({ query: '卢浮宫' }), ctx, { louvre: '卢浮宫' }))).toEqual([
      'louvre',
    ]);
  });

  it('combines dimensions with AND', () => {
    expect(
      ids(
        applyFilters(
          ALL,
          f({ departments: ['75'], date: '2026-11-01', types: ['always'] }),
          ctx,
          {},
        ),
      ),
    ).toEqual(['carnavalet']);
  });
});
