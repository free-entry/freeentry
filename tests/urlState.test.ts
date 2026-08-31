import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters';
import { decodeFilters, encodeFilters } from '@/lib/urlState';

describe('urlState', () => {
  it('encodes only non-default values', () => {
    expect(encodeFilters(DEFAULT_FILTERS).toString()).toBe('');
    const params = encodeFilters({ ...DEFAULT_FILTERS, types: ['always'], audiences: ['under-26-eu'] });
    expect(params.get('types')).toBe('always');
    expect(params.get('aud')).toBe('under-26-eu');
    expect(params.get('date')).toBeNull();
  });

  it('roundtrips a fully populated state', () => {
    const state: FilterState = {
      types: ['always', 'first-sunday'],
      date: '2026-09-06',
      center: [2.3522, 48.8566],
      radiusKm: 5,
      departments: ['75', '92'],
      communes: ['Versailles', 'Rueil-Malmaison'],
      arrondissements: [1, 4, 16],
      audiences: ['under-26-eu'],
      includePaid: true,
      query: 'musée',
    };
    expect(decodeFilters(encodeFilters(state))).toEqual(state);
  });

  it('tolerates garbage input', () => {
    const params = new URLSearchParams(
      'types=always,bogus&date=not-a-date&r=abc&center=1&dep=75,99&arr=0,7,21&aud=under-26-eu,bogus',
    );
    const state = decodeFilters(params);
    expect(state.types).toEqual(['always']);
    expect(state.date).toBeNull();
    expect(state.radiusKm).toBeNull();
    expect(state.center).toBeNull();
    expect(state.departments).toEqual(['75']);
    expect(state.arrondissements).toEqual([7]);
    expect(state.audiences).toEqual(['under-26-eu']);
  });
});
