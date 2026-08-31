import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS, type Category } from '@/lib/categories';
import styles from './CategoryBadge.module.css';

/** Colored-dot badge naming a museum's free-access category. */
export function CategoryBadgeContent({ category, label }: { category: Category; label: string }) {
  return (
    <span className={styles.badge}>
      <span
        className={styles.dot}
        style={{ backgroundColor: CATEGORY_COLORS[category] }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export default function CategoryBadge({ category }: { category: Category }) {
  const { t } = useTranslation();
  return <CategoryBadgeContent category={category} label={t(`categories.${category}`)} />;
}
