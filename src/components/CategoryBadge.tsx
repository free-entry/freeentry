import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS, type Category } from '@/lib/categories';
import styles from './CategoryBadge.module.css';

/** Colored-dot badge naming a museum's free-access category. */
export default function CategoryBadge({ category }: { category: Category }) {
  const { t } = useTranslation();
  return (
    <span className={styles.badge}>
      <span
        className={styles.dot}
        style={{ backgroundColor: CATEGORY_COLORS[category] }}
        aria-hidden="true"
      />
      {t(`categories.${category}`)}
    </span>
  );
}
