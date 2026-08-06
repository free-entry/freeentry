import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { eventDatesForYear, nthWeekdayOfMonth } from '@/lib/freeRules';
import { formatDate } from '@/lib/format';
import styles from './UpcomingFreeDays.module.css';

interface Upcoming {
  key: string;
  labelKey: string;
  date: string;
  estimated: boolean;
}

/** Strip of the next notable free days; tapping one applies the date filter. */
export default function UpcomingFreeDays() {
  const { t, i18n } = useTranslation();
  const { ctx, filters, setFilters, today } = useAppState();

  const upcoming = useMemo<Upcoming[]>(() => {
    const [year] = today.split('-').map(Number);
    const items: Upcoming[] = [];

    const currentMonth = Number(today.slice(5, 7));
    const firstOnOrAfter = (weekday: 'sunday' | 'saturday'): string => {
      for (let offset = 0; offset < 14; offset++) {
        const idx = currentMonth - 1 + offset;
        const date = nthWeekdayOfMonth(year + Math.floor(idx / 12), (idx % 12) + 1, 1, weekday);
        if (date >= today) return date;
      }
      return today;
    };

    items.push({
      key: 'first-sunday',
      labelKey: 'calendar.events.first-sunday',
      date: firstOnOrAfter('sunday'),
      estimated: false,
    });
    items.push({
      key: 'first-saturday',
      labelKey: 'calendar.events.first-saturday',
      date: firstOnOrAfter('saturday'),
      estimated: false,
    });

    const july14 = `${year}-07-14` >= today ? `${year}-07-14` : `${year + 1}-07-14`;
    items.push({ key: 'july-14', labelKey: 'calendar.events.july-14', date: july14, estimated: false });

    for (const key of ['museum-night', 'heritage-days'] as const) {
      for (const y of [year, year + 1]) {
        const info = eventDatesForYear(ctx.events, key, y);
        const next = info.dates.find((d) => d >= today);
        if (next) {
          items.push({ key, labelKey: `calendar.events.${key}`, date: next, estimated: info.estimated });
          break;
        }
      }
    }

    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [ctx.events, today]);

  return (
    <div className={styles.wrapper}>
      <h4 className={styles.title}>{t('calendar.upcoming')}</h4>
      <ul className={styles.list}>
        {upcoming.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={styles.item}
              aria-pressed={filters.date === item.date}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  date: prev.date === item.date ? null : item.date,
                }))
              }
            >
              <span className={styles.itemLabel}>{t(item.labelKey)}</span>
              <span className={styles.itemDate}>
                {formatDate(i18n.language, item.date)}
                {item.estimated && (
                  <span className={styles.estimated} title={t('calendar.estimatedBadge')}>
                    {' '}
                    ~{t('museum.estimated')}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
