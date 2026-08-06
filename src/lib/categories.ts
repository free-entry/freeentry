import type { FreeRule, Museum } from './types';

/**
 * Display category derived from a museum's rule set — drives marker colors,
 * badges and the free-type filter chips.
 */
export type Category =
  | 'always'
  | 'first-sunday'
  | 'first-sunday-booking'
  | 'first-sunday-low-season'
  | 'first-saturday'
  | 'nocturne'
  | 'special-days'
  | 'under-26-only'
  | 'none';

export const CATEGORY_ORDER: Category[] = [
  'always',
  'first-sunday',
  'first-sunday-booking',
  'first-sunday-low-season',
  'first-saturday',
  'nocturne',
  'special-days',
  'under-26-only',
  'none',
];

/**
 * Colorblind-aware palette (Okabe–Ito based). Verified for contrast against
 * the map background in the a11y audit; categories are never encoded by
 * color alone (badges carry text).
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  always: '#009E73',
  'first-sunday': '#0072B2',
  'first-sunday-booking': '#56B4E9',
  'first-sunday-low-season': '#5D3A9B',
  'first-saturday': '#E69F00',
  nocturne: '#A03A68',
  'special-days': '#CC79A7',
  'under-26-only': '#D55E00',
  none: '#8D99A6',
};

/** The filter-chip category a single rule belongs to. */
export function ruleCategory(rule: FreeRule): Category {
  if ((rule.audience ?? 'everyone') !== 'everyone') return 'under-26-only';
  switch (rule.kind) {
    case 'always':
      return 'always';
    case 'nth-weekday':
      if (rule.evening) return 'nocturne';
      // Rare non-first occurrences (e.g. LAST Sunday of the month) would make
      // the "1st Sunday" badge false — group them under special days instead.
      if ((rule.nth ?? 1) !== 1) return 'special-days';
      if (rule.weekday === 'sunday') {
        if (rule.months) return 'first-sunday-low-season';
        return rule.reservationRequired ? 'first-sunday-booking' : 'first-sunday';
      }
      if (rule.weekday === 'saturday') return 'first-saturday';
      return 'special-days';
    case 'event':
    case 'annual-date':
      return 'special-days';
  }
}

/** Museum-level category: the highest-precedence category among its rules. */
export function deriveCategory(museum: Museum): Category {
  if (museum.freeAccess.length === 0) return 'none';
  let best = CATEGORY_ORDER.length - 1;
  for (const rule of museum.freeAccess) {
    best = Math.min(best, CATEGORY_ORDER.indexOf(ruleCategory(rule)));
  }
  return CATEGORY_ORDER[best];
}
