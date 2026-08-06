import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { eventDatesForYear, freeCountByDay } from '@/lib/freeRules';
import { applyFilters } from '@/lib/filters';
import { formatDate } from '@/lib/format';
import UpcomingFreeDays from './UpcomingFreeDays';
import styles from './CalendarView.module.css';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Month grid with per-day free counts; picking a day sets the date filter. */
export default function CalendarView() {
  const { t, i18n } = useTranslation();
  const { museums, filters, setFilters, ctx, localizedNames, today } = useAppState();

  const [todayYear, todayMonth] = today.split('-').map(Number);
  const [view, setView] = useState(() => {
    const base = filters.date ?? today;
    const [y, m] = base.split('-').map(Number);
    return { year: y, month: m };
  });

  // Counts reflect every active filter except the date itself.
  const countedSet = useMemo(
    () => applyFilters(museums, { ...filters, date: null }, ctx, localizedNames),
    [museums, filters, ctx, localizedNames],
  );

  const counts = useMemo(
    () => freeCountByDay(countedSet, view.year, view.month, ctx),
    [countedSet, view, ctx],
  );

  const eventDays = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const key of ['museum-night', 'heritage-days'] as const) {
      const info = eventDatesForYear(ctx.events, key, view.year);
      for (const date of info.dates) map.set(date, info.estimated);
    }
    map.set(`${view.year}-07-14`, false);
    return map;
  }, [ctx.events, view.year]);

  const monthLabel = new Intl.DateTimeFormat(i18n.language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(view.year, view.month - 1, 15)));

  // Monday-first weekday header.
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
    // 2026-03-02 was a Monday.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2026, 2, 2 + i, 12))),
    );
  }, [i18n.language]);

  const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay(); // 0=Sun
  const leadingBlanks = (firstDow + 6) % 7; // Monday-first offset

  function shiftMonth(delta: number) {
    setView((prev) => {
      const m = prev.month + delta;
      if (m < 1) return { year: prev.year - 1, month: 12 };
      if (m > 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: m };
    });
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.monthBar}>
        <button
          type="button"
          className={styles.navButton}
          aria-label={t('calendar.prevMonth')}
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button
          type="button"
          className={styles.navButton}
          aria-label={t('calendar.nextMonth')}
          onClick={() => shiftMonth(1)}
        >
          ›
        </button>
      </div>

      <div className={styles.grid}>
        {weekdayLabels.map((label, i) => (
          <span key={`h${i}`} className={styles.weekday} aria-hidden="true">
            {label}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = `${view.year}-${pad(view.month)}-${pad(day)}`;
          const count = counts.get(iso) ?? 0;
          const isToday = view.year === todayYear && view.month === todayMonth && iso === today;
          const eventEstimated = eventDays.get(iso);
          return (
            <button
              key={iso}
              type="button"
              className={[
                styles.day,
                isToday ? styles.dayToday : '',
                count > 0 ? styles.dayHasFree : '',
              ].join(' ')}
              aria-pressed={filters.date === iso}
              aria-label={t('calendar.selectDay', {
                date: formatDate(i18n.language, iso),
                count,
              })}
              onClick={() =>
                setFilters((prev) => ({ ...prev, date: prev.date === iso ? null : iso }))
              }
            >
              <span className={styles.dayNumber}>{day}</span>
              {count > 0 && <span className={styles.count}>{count}</span>}
              {eventDays.has(iso) && (
                <span
                  className={eventEstimated ? styles.eventDotEstimated : styles.eventDot}
                  title={eventEstimated ? t('calendar.estimatedBadge') : undefined}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <UpcomingFreeDays />
    </div>
  );
}
