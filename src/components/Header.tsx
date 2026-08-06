import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import LanguageSwitcher from './LanguageSwitcher';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenFilters: () => void;
  onOpenAbout: () => void;
}

export default function Header({ onOpenFilters, onOpenAbout }: HeaderProps) {
  const { t } = useTranslation();
  const { filters, setFilters, results } = useAppState();

  return (
    <header className={styles.header}>
      <a className={styles.wordmark} href={import.meta.env.BASE_URL}>
        <svg
          className={styles.mark}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          {/* Simplified museum front: pediment + columns. */}
          <path
            fill="currentColor"
            d="M12 2 2 8v2h20V8L12 2zm-8 9h2.5v7H4v2h16v-2h-2.5v-7H20v-2H4v2zm4.5 0h2v7h-2v-7zm5 0h2v7h-2v-7z"
          />
        </svg>
        <span className={styles.title}>{t('app.title')}</span>
      </a>

      <div className={styles.search} role="search">
        <input
          type="search"
          className={styles.searchInput}
          placeholder={t('header.searchPlaceholder')}
          aria-label={t('header.searchLabel')}
          value={filters.query}
          onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
        />
      </div>

      <button type="button" className={styles.filtersButton} onClick={onOpenFilters}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.filterIcon}>
          <path
            fill="currentColor"
            d="M3 5h18v2l-7 7v5l-4-2v-3L3 7V5z"
          />
        </svg>
        <span>{t('header.filters')}</span>
        <span className={styles.count} aria-hidden="true">
          {results.length}
        </span>
      </button>

      <LanguageSwitcher />

      <button
        type="button"
        className={styles.aboutButton}
        aria-label={t('about.dataSources')}
        onClick={onOpenAbout}
      >
        ⓘ
      </button>
    </header>
  );
}
