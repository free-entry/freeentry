import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { CATEGORY_COLORS, CATEGORY_ORDER, deriveCategory, type Category } from '@/lib/categories';
import styles from './MapLegend.module.css';

/** Collapsible legend for the marker colors currently visible on the map. */
export default function MapLegend() {
  const { t } = useTranslation();
  const { results } = useAppState();

  const present = useMemo(() => {
    const set = new Set<Category>(results.map(deriveCategory));
    return CATEGORY_ORDER.filter((c) => set.has(c));
  }, [results]);

  if (present.length === 0) return null;

  return (
    <details className={styles.legend} open={window.matchMedia('(min-width: 900px)').matches}>
      <summary className={styles.summary}>{t('filters.freeType')}</summary>
      <ul className={styles.list}>
        {present.map((category) => (
          <li key={category} className={styles.item}>
            <span
              className={styles.dot}
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
              aria-hidden="true"
            />
            {t(`categories.${category}`)}
          </li>
        ))}
      </ul>
    </details>
  );
}
