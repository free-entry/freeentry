import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { brandString } from '@/lib/brand';
import { COUNTRY_CODE } from '@/countries';
import { COUNTRY_MARKS } from '@/countries/marks';
import { useLocation } from 'react-router-dom';
import { localeFromPathname, localizedPathname } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import SearchDialog from './SearchDialog';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenFilters: () => void;
  onOpenAbout: () => void;
}

export default function Header({ onOpenFilters, onOpenAbout }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { resetFilters, results } = useAppState();
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  // Home under the current path prefix (unprefixed = English).
  const homeHref = `${import.meta.env.BASE_URL}${localizedPathname('/', localeFromPathname(location.pathname) ?? 'en').replace(/^\//, '')}`;

  // Ctrl/Cmd+K opens the search modal from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.side}>
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

        <button
          type="button"
          className={styles.aboutButton}
          aria-label={t('filters.reset')}
          title={t('filters.reset')}
          onClick={resetFilters}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={styles.smallIcon}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <button
          type="button"
          className={styles.aboutButton}
          aria-label={t('header.searchLabel')}
          title={`${t('header.searchLabel')} (Ctrl+K)`}
          onClick={() => setSearchOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={styles.smallIcon}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5L21 21" />
          </svg>
        </button>
      </div>

      <a className={styles.wordmark} href={homeHref}>
        <svg
          className={styles.mark}
          viewBox="0 0 32 32"
          aria-hidden="true"
          focusable="false"
        >
          {/* Country landmark silhouette (Eiffel Tower / Colosseum / belfry). */}
          <g
            fill="currentColor"
            dangerouslySetInnerHTML={{ __html: COUNTRY_MARKS[COUNTRY_CODE] ?? COUNTRY_MARKS.fr }}
          />
        </svg>
        <span className={styles.title} title={brandString(i18n.language, 'title', t('app.title'))}>
          {brandString(i18n.language, 'titleShort', t('app.titleShort'))}
        </span>
      </a>

      <div className={styles.side}>
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
          href="https://github.com/free-entry/freeentry"
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
      </div>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
