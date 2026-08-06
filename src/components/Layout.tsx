import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import Header from './Header';
import MapView from './MapView';
import styles from './Layout.module.css';

export default function Layout() {
  const { t } = useTranslation();
  const { results, selected } = useAppState();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <a href="#results" className={styles.skipLink}>
        {t('app.skipToList')}
      </a>
      <Header onOpenFilters={() => setFiltersOpen(true)} />
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label={t('list.showList')}>
          {/* Placeholder panes — replaced by FilterPanel/MuseumList/DetailPanel. */}
          <div id="results" className={styles.sidebarInner}>
            <p aria-live="polite">{t('filters.resultCount', { count: results.length })}</p>
            {selected && <p>{selected.name}</p>}
          </div>
        </aside>
        <main className={styles.mapArea}>
          <MapView />
        </main>
      </div>
      {filtersOpen && (
        <div role="dialog" aria-modal="true" aria-label={t('filters.title')}>
          {/* FilterPanel dialog lands in Task 10. */}
          <button type="button" onClick={() => setFiltersOpen(false)}>
            {t('filters.close')}
          </button>
        </div>
      )}
    </div>
  );
}
