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
          viewBox="0 0 32 32"
          aria-hidden="true"
          focusable="false"
        >
          {/* Eiffel Tower silhouette. */}
          <g fill="currentColor">
            <path d="M15.25 7.2 15.62 2.5C15.7 1.95 16.3 1.95 16.38 2.5L16.75 7.2Z" />
            <rect x="14.5" y="5.1" width="3" height="2.1" rx=".45" />
            <path d="M16.85 7.2c.25 3.4.65 6.4 1.75 9.05h-5.2c1.1-2.65 1.5-5.65 1.75-9.05Z" />
            <rect x="12.1" y="16.15" width="7.8" height="2.05" rx=".35" />
            <path d="M12.5 18.2h7l1.8 3.8h-3.65l-.35-3.3h-2.6l-.35 3.3H10.7Z" />
            <rect x="9.45" y="21.95" width="13.1" height="2.05" rx=".35" />
            <path d="M10.13 24h11.74L26 30h-5.8a4.2 4.4 0 0 0-8.4 0H6Z" />
          </g>
        </svg>
        <span className={styles.title} title={t('app.title')}>
          {t('app.titleShort')}
        </span>
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
            d="M4.22657 2C2.50087 2 1.58526 4.03892 2.73175 5.32873L8.99972 12.3802V19C8.99972 19.3788 9.21373 19.725 9.55251 19.8944L13.5525 21.8944C13.8625 22.0494 14.2306 22.0329 14.5255 21.8507C14.8203 21.6684 14.9997 21.3466 14.9997 21V12.3802L21.2677 5.32873C22.4142 4.03893 21.4986 2 19.7729 2H4.22657Z"
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
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={styles.infoIcon}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>

      <a
        className={styles.aboutButton}
        href="https://github.com/travel-eu/free-museums-paris"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        title="GitHub"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.githubIcon}>
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
      </a>
    </header>
  );
}
