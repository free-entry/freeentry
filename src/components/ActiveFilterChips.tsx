import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import type { FilterState } from '@/lib/filters';
import { formatDate } from '@/lib/format';
import { DEPARTMENT_NAMES } from './AreaFilter';
import styles from './ActiveFilterChips.module.css';

interface Chip {
  key: string;
  label: string;
  remove: (prev: FilterState) => FilterState;
}

/** Removable chips summarizing every active filter dimension. */
export default function ActiveFilterChips() {
  const { t, i18n } = useTranslation();
  const { filters, setFilters, resetFilters } = useAppState();

  const chips: Chip[] = [];

  for (const type of filters.types) {
    chips.push({
      key: `type-${type}`,
      label: t(`categories.${type}`),
      remove: (prev) => ({ ...prev, types: prev.types.filter((c) => c !== type) }),
    });
  }
  if (filters.date) {
    chips.push({
      key: 'date',
      label: t('filters.freeOnDate', { date: formatDate(i18n.language, filters.date) }),
      remove: (prev) => ({ ...prev, date: null }),
    });
  }
  if (filters.center && filters.radiusKm !== null) {
    chips.push({
      key: 'distance',
      label: t('filters.withinKm', { km: filters.radiusKm }),
      remove: (prev) => ({ ...prev, center: null, radiusKm: null }),
    });
  }
  for (const dep of filters.departments) {
    chips.push({
      key: `dep-${dep}`,
      label: `${DEPARTMENT_NAMES[dep]} (${dep})`,
      remove: (prev) => ({ ...prev, departments: prev.departments.filter((d) => d !== dep) }),
    });
  }
  for (const commune of filters.communes) {
    chips.push({
      key: `commune-${commune}`,
      label: commune,
      remove: (prev) => ({ ...prev, communes: prev.communes.filter((c) => c !== commune) }),
    });
  }
  for (const arr of filters.arrondissements) {
    chips.push({
      key: `arr-${arr}`,
      label: t('filters.arrondissementLabel', { number: arr }),
      remove: (prev) => ({
        ...prev,
        arrondissements: prev.arrondissements.filter((a) => a !== arr),
      }),
    });
  }
  if (filters.under26) {
    chips.push({
      key: 'under26',
      label: t('filters.under26'),
      remove: (prev) => ({ ...prev, under26: false }),
    });
  }
  if (filters.includePaid) {
    chips.push({
      key: 'paid',
      label: t('filters.includePaid'),
      remove: (prev) => ({ ...prev, includePaid: false }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={styles.wrapper} role="group" aria-label={t('filters.activeFilters')}>
      <ul className={styles.list}>
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              className={styles.chip}
              aria-label={t('filters.removeFilter', { label: chip.label })}
              onClick={() => setFilters(chip.remove)}
            >
              {chip.label} <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
        {chips.length > 1 && (
          <li>
            <button type="button" className={styles.reset} onClick={resetFilters}>
              {t('filters.reset')}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
