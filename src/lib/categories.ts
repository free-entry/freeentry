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
  nocturne: '#D55E00',
  'special-days': '#CC79A7',
  'under-26-only': '#8C6D31',
  none: '#8D99A6',
};

function forEveryone(rule: FreeRule): boolean {
  return (rule.audience ?? 'everyone') === 'everyone';
}

export function deriveCategory(museum: Museum): Category {
  const rules = museum.freeAccess;
  if (rules.length === 0) return 'none';

  const everyone = rules.filter(forEveryone);
  if (everyone.some((r) => r.kind === 'always')) return 'always';

  const daytime = everyone.filter((r) => r.kind === 'nth-weekday' && !r.evening);
  const sundays = daytime.filter((r) => r.weekday === 'sunday');
  if (sundays.some((r) => !r.months && !r.reservationRequired)) return 'first-sunday';
  if (sundays.some((r) => !r.months && r.reservationRequired)) return 'first-sunday-booking';
  if (sundays.length > 0) return 'first-sunday-low-season';
  if (daytime.some((r) => r.weekday === 'saturday')) return 'first-saturday';

  if (everyone.some((r) => r.kind === 'nth-weekday' && r.evening)) return 'nocturne';
  if (everyone.some((r) => r.kind === 'event' || r.kind === 'annual-date')) return 'special-days';
  return 'under-26-only';
}
