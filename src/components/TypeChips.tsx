import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { CATEGORY_COLORS, CATEGORY_ORDER, type Category } from '@/lib/categories';
import styles from './TypeChips.module.css';

/** 'none' is not a rule type — paid visibility has its own toggle. */
const CHIP_CATEGORIES = CATEGORY_ORDER.filter((c): c is Category => c !== 'none');

export default function TypeChips() {
  const { t } = useTranslation();
  const { filters, setFilters } = useAppState();

  function toggle(category: Category) {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(category)
        ? prev.types.filter((c) => c !== category)
        : [...prev.types, category],
    }));
  }

  return (
    <ul className={styles.list} aria-label={t('filters.freeType')}>
      {CHIP_CATEGORIES.map((category) => {
        const active = filters.types.includes(category);
        return (
          <li key={category}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={active}
              onClick={() => toggle(category)}
            >
              <span
                className={styles.dot}
                style={{ backgroundColor: CATEGORY_COLORS[category] }}
                aria-hidden="true"
              />
              {t(`categories.${category}`)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
