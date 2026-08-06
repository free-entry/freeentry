import type { FreeRule, Museum } from './types';

/**
 * Display category derived from a museum's rule set — drives marker colors,
 * badges and the free-type filter chips.
 */
export type Category =
  | 'always'
  | 'weekly'
  | 'first-sunday'
  | 'first-sunday-booking'
  | 'first-sunday-low-season'
  | 'first-saturday'
  | 'nocturne'
  | 'july-14'
  | 'special-days'
  | 'under-26-only'
  | 'under-18-only'
  | 'residents-only'
  | 'none';

export const CATEGORY_ORDER: Category[] = [
  'always',
  'weekly',
  'first-sunday',
  'first-sunday-booking',
  'first-sunday-low-season',
  'first-saturday',
  'nocturne',
  'july-14',
  'special-days',
  'under-26-only',
  'under-18-only',
  'residents-only',
  'none',
];

/**
 * Colorblind-aware palette (Okabe–Ito hue relationships, brightened for the
 * "sunny poster" theme). Categories are never encoded by color alone (badges
 * carry text); colors appear as outlined dots and edge accents.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  always: '#00ba7c',
  weekly: '#00a3a3',
  'first-sunday': '#0b84d8',
  'first-sunday-booking': '#64c7f2',
  'first-sunday-low-season': '#8256d0',
  'first-saturday': '#f2a900',
  nocturne: '#ba4fa0',
  'july-14': '#e23a3a',
  'special-days': '#f48fb9',
  'under-26-only': '#e8590c',
  'under-18-only': '#846c15',
  'residents-only': '#7f8fa6',
  none: '#9aa7b4',
};

/** The filter-chip category a single rule belongs to. */
export function ruleCategory(rule: FreeRule): Category {
  if (rule.audience === 'residents') return 'residents-only';
  if (rule.audience === 'under-18') return 'under-18-only';
  if ((rule.audience ?? 'everyone') !== 'everyone') return 'under-26-only';
  switch (rule.kind) {
    case 'always':
      return 'always';
    case 'weekly':
      return 'weekly';
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
    case 'annual-date':
      return rule.date === '07-14' ? 'july-14' : 'special-days';
    case 'event':
      return 'special-days';
  }
}

/**
 * Every category a museum's rules cover, in precedence order. Drives the
 * badge row — a museum with a nocturne, a 14 July rule and an under-26
 * scheme wears all three.
 */
export function deriveCategories(museum: Museum): Category[] {
  if (museum.freeAccess.length === 0) return ['none'];
  const present = new Set(museum.freeAccess.map(ruleCategory));
  return CATEGORY_ORDER.filter((c) => present.has(c));
}

/** Museum-level primary category (marker color, legend): highest precedence. */
export function deriveCategory(museum: Museum): Category {
  return deriveCategories(museum)[0];
}
