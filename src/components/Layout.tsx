import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import Header from './Header';
import MapView from './MapView';
import MuseumList from './MuseumList';
import ActiveFilterChips from './ActiveFilterChips';
import FilterPanel from './FilterPanel';
import styles from './Layout.module.css';

export default function Layout() {
  const { t } = useTranslation();
  const { selected } = useAppState();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <a href="#results" className={styles.skipLink}>
        {t('app.skipToList')}
      </a>
      <Header onOpenFilters={() => setFiltersOpen(true)} />
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label={t('list.showList')}>
          <div id="results" className={styles.sidebarInner}>
            <ActiveFilterChips />
            {/* DetailPanel (Task 12) overlays the list when a museum is selected. */}
            {selected && <p className={styles.selectedNote}>{selected.name}</p>}
            <MuseumList />
          </div>
        </aside>
        <main className={styles.mapArea}>
          <MapView />
        </main>
      </div>
      {filtersOpen && <FilterPanel onClose={() => setFiltersOpen(false)} />}
    </div>
  );
}
