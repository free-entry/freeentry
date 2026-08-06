import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import MuseumCard from './MuseumCard';
import styles from './MuseumList.module.css';

export default function MuseumList() {
  const { t } = useTranslation();
  const { results, selected, select, filters } = useAppState();

  return (
    <div className={styles.wrapper}>
      <p className={styles.count} aria-live="polite">
        {t('filters.resultCount', { count: results.length })}
        <span className={styles.sort}>
          {' · '}
          {filters.center ? t('list.sortedByDistance') : t('list.sortedByName')}
        </span>
      </p>
      {results.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('list.empty')}</p>
          <p className={styles.emptyHint}>{t('list.emptyHint')}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {results.map((museum) => (
            <li key={museum.id}>
              <MuseumCard
                museum={museum}
                active={selected?.id === museum.id}
                onSelect={() => select(museum.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
