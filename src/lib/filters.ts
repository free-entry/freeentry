import type { Category } from './categories';
import { deriveCategory, ruleCategory } from './categories';
import { haversineKm } from './distance';
import type { RuleContext } from './freeRules';
import { ruleActiveOn } from './freeRules';
import type { Department, Museum } from './types';

export interface FilterState {
  /** Free-type chips; [] = no type filter. */
  types: Category[];
  /** 'YYYY-MM-DD' — keep only museums free on this date; null = no date filter. */
  date: string | null;
  /** Distance filter center [lng, lat]; active only with radiusKm. */
  center: [number, number] | null;
  radiusKm: number | null;
  departments: Department[];
  communes: string[];
  arrondissements: number[];
  /** Visitor is an under-26 EU resident: audience rules count as free access. */
  under26: boolean;
  /** Show museums with no known free scheme. */
  includePaid: boolean;
  query: string;
}

export const DEFAULT_FILTERS: FilterState = {
  types: [],
  date: null,
  center: null,
  radiusKm: null,
  departments: [],
  communes: [],
  arrondissements: [],
  under26: false,
  includePaid: false,
  query: '',
};

/** Lowercased, diacritic-free, punctuation-free text for searching. */
export function searchFold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Applies every filter dimension (AND across dimensions, OR within one).
 * The type and date dimensions combine at RULE level: one same rule must
 * match a selected type AND be active on the selected date.
 * `ctx.under26` is overridden by `filters.under26`.
 */
export function applyFilters(
  museums: Museum[],
  filters: FilterState,
  ctx: RuleContext,
  localizedNames: Record<string, string>,
): Museum[] {
  const ruleCtx: RuleContext = { ...ctx, under26: filters.under26 };
  const query = searchFold(filters.query);
  const areaActive =
    filters.departments.length > 0 ||
    filters.communes.length > 0 ||
    filters.arrondissements.length > 0;

  return museums.filter((museum) => {
    if (!filters.includePaid && deriveCategory(museum) === 'none') return false;

    if (filters.types.length > 0 || filters.date) {
      const match = museum.freeAccess.some((rule) => {
        if (filters.types.length > 0 && !filters.types.includes(ruleCategory(rule))) return false;
        if (filters.date && !ruleActiveOn(rule, filters.date, ruleCtx)) return false;
        return true;
      });
      if (!match) return false;
    }

    if (areaActive) {
      const inArea =
        filters.departments.includes(museum.department) ||
        filters.communes.includes(museum.commune) ||
        (museum.arrondissement !== undefined &&
          filters.arrondissements.includes(museum.arrondissement));
      if (!inArea) return false;
    }

    if (filters.center && filters.radiusKm !== null) {
      if (haversineKm(filters.center, museum.coordinates) > filters.radiusKm) return false;
    }

    if (query) {
      const haystack = searchFold(`${museum.name} ${localizedNames[museum.id] ?? ''}`);
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}
