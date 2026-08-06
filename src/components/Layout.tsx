import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { useIsWide } from '@/lib/useMediaQuery';
import DocumentMeta from './DocumentMeta';
import Header from './Header';
import MapView from './MapView';
import MuseumList from './MuseumList';
import ActiveFilterChips from './ActiveFilterChips';
import FilterPanel from './FilterPanel';
import DetailPanel from './DetailPanel';
import BottomSheet from './BottomSheet';
import OfflineBanner from './OfflineBanner';
import UpdateToast from './UpdateToast';
import AboutDialog from './AboutDialog';
import styles from './Layout.module.css';

export default function Layout() {
  const { t } = useTranslation();
  const { selected, select, results, filters, setFilters, today } = useAppState();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const isWide = useIsWide();

  const todayChip = (
    <button
      type="button"
      className={styles.todayChip}
      aria-pressed={filters.date === today}
      onClick={() => setFilters((prev) => ({ ...prev, date: prev.date === today ? null : today }))}
    >
      {t('filters.today')}
    </button>
  );

  return (
    <div className={styles.shell}>
      <DocumentMeta />
      <a href="#results" className={styles.skipLink}>
        {t('app.skipToList')}
      </a>
      <Header onOpenFilters={() => setFiltersOpen(true)} onOpenAbout={() => setAboutOpen(true)} />
      <OfflineBanner />
      <div className={styles.body}>
        {isWide && (
          <aside className={styles.sidebar} aria-label={t('list.showList')}>
            <div id="results" className={styles.sidebarInner}>
              {selected ? (
                <DetailPanel museum={selected} onBack={() => select(null)} />
              ) : (
                <>
                  <ActiveFilterChips />
                  <MuseumList />
                </>
              )}
            </div>
          </aside>
        )}
        <main className={styles.mapArea}>
          <MapView />
        </main>
      </div>

      {!isWide &&
        (selected ? (
          <BottomSheet
            key={selected.id}
            label={selected.name}
            initialDetent="full"
            peekContent={<span className={styles.peekName}>{selected.name}</span>}
          >
            <div id="results">
              <DetailPanel museum={selected} onBack={() => select(null)} />
            </div>
          </BottomSheet>
        ) : (
          <BottomSheet
            label={t('list.showList')}
            initialDetent="peek"
            peekContent={
              <>
                <span>{t('filters.resultCount', { count: results.length })}</span>
                {todayChip}
              </>
            }
          >
            <div id="results">
              <ActiveFilterChips />
              <MuseumList />
            </div>
          </BottomSheet>
        ))}

      {filtersOpen && <FilterPanel onClose={() => setFiltersOpen(false)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      <UpdateToast />
    </div>
  );
}
