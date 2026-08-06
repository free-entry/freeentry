import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import Dialog from './Dialog';
import TypeChips from './TypeChips';
import DistanceFilter from './DistanceFilter';
import AreaFilter from './AreaFilter';
import CalendarView from './CalendarView';
import styles from './FilterPanel.module.css';

interface FilterPanelProps {
  onClose: () => void;
}

export default function FilterPanel({ onClose }: FilterPanelProps) {
  const { t } = useTranslation();
  const { filters, setFilters, resetFilters, results, today } = useAppState();

  return (
    <Dialog label={t('filters.title')} onClose={onClose}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.title}>{t('filters.title')}</h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label={t('filters.close')}
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('filters.freeType')}</h3>
          <TypeChips />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('filters.date')}</h3>
          <div className={styles.dateQuick}>
            <button
              type="button"
              className={styles.dateChip}
              aria-pressed={filters.date === today}
              onClick={() =>
                setFilters((prev) => ({ ...prev, date: prev.date === today ? null : today }))
              }
            >
              {t('filters.today')}
            </button>
            <button
              type="button"
              className={styles.dateChip}
              aria-pressed={filters.date === null}
              onClick={() => setFilters((prev) => ({ ...prev, date: null }))}
            >
              {t('filters.anyDate')}
            </button>
          </div>
          <CalendarView />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('filters.distance')}</h3>
          <DistanceFilter onPickOnMap={onClose} />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('filters.area')}</h3>
          <AreaFilter />
        </section>

        <section className={styles.section}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={filters.under26}
              onChange={(e) => setFilters((prev) => ({ ...prev, under26: e.target.checked }))}
            />
            <span>
              {t('filters.under26')}
              <span className={styles.toggleHint}>{t('filters.under26Hint')}</span>
            </span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={filters.includePaid}
              onChange={(e) => setFilters((prev) => ({ ...prev, includePaid: e.target.checked }))}
            />
            <span>{t('filters.includePaid')}</span>
          </label>
        </section>

        <footer className={styles.footer}>
          <button type="button" className={styles.resetButton} onClick={resetFilters}>
            {t('filters.reset')}
          </button>
          <button type="button" className={styles.applyButton} onClick={onClose}>
            {t('filters.showResults', { count: results.length })}
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
