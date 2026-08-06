import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import Dialog from './Dialog';
import styles from './SearchDialog.module.css';

interface SearchDialogProps {
  onClose: () => void;
}

/** Search modal (magnifier button / Ctrl+K). Filters the list live as you type. */
export default function SearchDialog({ onClose }: SearchDialogProps) {
  const { t } = useTranslation();
  const { filters, setFilters, results } = useAppState();

  return (
    <Dialog label={t('header.searchLabel')} onClose={onClose} variant="center">
      <div className={styles.body}>
        <input
          type="search"
          className={styles.input}
          placeholder={t('header.searchPlaceholder')}
          aria-label={t('header.searchLabel')}
          value={filters.query}
          onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClose();
          }}
        />
        <p className={styles.count}>
          {t('filters.resultCount', { count: results.length })}
        </p>
      </div>
    </Dialog>
  );
}
