import { CATEGORY_ORDER, type Category } from './categories';
import { DEFAULT_FILTERS, type FilterState } from './filters';
import type { Department } from './types';

const DEPARTMENTS: Department[] = ['75', '77', '78', '91', '92', '93', '94', '95'];

/** Serializes non-default filter values into shareable URL search params. */
export function encodeFilters(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.types.length) p.set('types', f.types.join(','));
  if (f.date) p.set('date', f.date);
  if (f.center) p.set('center', f.center.map((n) => n.toFixed(5)).join(','));
  if (f.radiusKm !== null) p.set('r', String(f.radiusKm));
  if (f.departments.length) p.set('dep', f.departments.join(','));
  if (f.communes.length) p.set('commune', f.communes.join(','));
  if (f.arrondissements.length) p.set('arr', f.arrondissements.join(','));
  if (f.under26) p.set('under26', '1');
  if (f.includePaid) p.set('paid', '1');
  if (f.query) p.set('q', f.query);
  return p;
}

function list(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

function finite(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parses URL search params into a FilterState, dropping anything invalid. */
export function decodeFilters(p: URLSearchParams): FilterState {
  const types = list(p.get('types')).filter((t): t is Category =>
    (CATEGORY_ORDER as string[]).includes(t),
  );
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.get('date') ?? '') ? p.get('date') : null;

  let center: [number, number] | null = null;
  const centerParts = list(p.get('center')).map(Number);
  if (centerParts.length === 2 && centerParts.every(Number.isFinite)) {
    center = [centerParts[0], centerParts[1]];
  }

  return {
    ...DEFAULT_FILTERS,
    types,
    date,
    center,
    radiusKm: finite(p.get('r')),
    departments: list(p.get('dep')).filter((d): d is Department =>
      (DEPARTMENTS as string[]).includes(d),
    ),
    communes: list(p.get('commune')),
    arrondissements: list(p.get('arr'))
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 20),
    under26: p.get('under26') === '1',
    includePaid: p.get('paid') === '1',
    query: p.get('q') ?? '',
  };
}
