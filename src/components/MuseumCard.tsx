import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import type { Museum } from '@/lib/types';
import { deriveCategory } from '@/lib/categories';
import { nextFreeDate, isFreeOn } from '@/lib/freeRules';
import { haversineKm } from '@/lib/distance';
import { formatDate, formatKm } from '@/lib/format';
import CategoryBadge from './CategoryBadge';
import styles from './MuseumCard.module.css';

interface MuseumCardProps {
  museum: Museum;
  active: boolean;
  onSelect: () => void;
}

export default function MuseumCard({ museum, active, onSelect }: MuseumCardProps) {
  const { t, i18n } = useTranslation();
  const { ctx, content, filters, today } = useAppState();

  const localized = content[museum.id]?.name;
  const category = deriveCategory(museum);
  const freeToday = isFreeOn(museum, today, ctx);
  const next = freeToday ? null : nextFreeDate(museum, today, ctx);
  const distance =
    filters.center !== null ? haversineKm(filters.center, museum.coordinates) : null;
  const hasBooking = museum.freeAccess.some((r) => r.reservationRequired);
  const hasEvening = museum.freeAccess.some((r) => r.evening);

  const place =
    museum.arrondissement !== undefined
      ? `${t('filters.arrondissementLabel', { number: museum.arrondissement })}`
      : `${museum.commune} · ${museum.department}`;

  return (
    <button
      type="button"
      className={`${styles.card} ${active ? styles.active : ''}`}
      aria-pressed={active}
      onClick={onSelect}
    >
      <span className={styles.nameRow}>
        <span className={styles.name}>{localized ?? museum.name}</span>
        {localized && <span className={styles.frenchName}>{museum.name}</span>}
      </span>
      <span className={styles.badges}>
        <CategoryBadge category={category} />
        {freeToday && <span className={styles.today}>{t('museum.todayFree')}</span>}
        {hasBooking && (
          <span className={styles.flag} title={t('museum.bookingRequired')}>
            🎟 {t('museum.bookingRequired')}
          </span>
        )}
        {hasEvening && <span className={styles.flag}>🌙 {t('museum.eveningOnly')}</span>}
      </span>
      <span className={styles.meta}>
        <span>{place}</span>
        {distance !== null && <span>· {formatKm(i18n.language, distance)}</span>}
        {next && (
          <span className={styles.next}>
            · {t('museum.nextFreeDate', { date: formatDate(i18n.language, next.date) })}
            {next.estimated ? ` (${t('museum.estimated')})` : ''}
          </span>
        )}
      </span>
    </button>
  );
}
