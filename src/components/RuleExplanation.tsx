import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import type { FreeRule } from '@/lib/types';
import { eventDatesForYear } from '@/lib/freeRules';
import { formatDate, monthName, weekdayName } from '@/lib/format';
import styles from './RuleExplanation.module.css';

/** One free-access rule as a plain-language sentence in the user's locale. */
export default function RuleExplanation({ rule }: { rule: FreeRule }) {
  const { t, i18n } = useTranslation();
  const { ctx, today } = useAppState();
  const locale = i18n.language;

  let sentence = '';
  let estimated = false;
  let eventNext: string | null = null;

  switch (rule.kind) {
    case 'always':
      sentence =
        rule.audience === 'under-26-eu'
          ? t('rules.alwaysUnder26')
          : rule.audience === 'under-18'
            ? t('rules.alwaysUnder18')
            : t('rules.always');
      break;
    case 'nth-weekday': {
      sentence = t('rules.firstWeekday', {
        weekday: weekdayName(locale, rule.weekday ?? 'sunday'),
      });
      if (rule.months && rule.months.length > 0) {
        sentence += `, ${t('rules.monthsRange', {
          from: monthName(locale, rule.months[0]),
          to: monthName(locale, rule.months[rule.months.length - 1]),
        })}`;
      }
      if (rule.evening) sentence += `, ${t('rules.evening')}`;
      break;
    }
    case 'annual-date':
      sentence = rule.date === '07-14' ? t('rules.july14') : t('rules.annualDate', { date: rule.date ?? '' });
      break;
    case 'event': {
      sentence = rule.event === 'museum-night' ? t('rules.museumNight') : t('rules.heritageDays');
      if (rule.event) {
        const year = Number(today.slice(0, 4));
        for (const y of [year, year + 1]) {
          const info = eventDatesForYear(ctx.events, rule.event, y);
          const next = info.dates.find((d) => d >= today);
          if (next) {
            eventNext = next;
            estimated = info.estimated;
            break;
          }
        }
      }
      break;
    }
  }

  return (
    <li className={styles.rule}>
      <span className={styles.sentence}>
        {sentence}
        {eventNext && (
          <span className={styles.next}>
            {' '}
            ({t('rules.nextDate', { date: formatDate(locale, eventNext) })}
            {estimated ? `, ${t('museum.estimated')}` : ''})
          </span>
        )}
      </span>
      {rule.reservationRequired && (
        <span className={styles.booking}>
          {t('museum.bookingRequired')}
          {rule.reservationUrl && (
            <>
              {' — '}
              <a href={rule.reservationUrl} target="_blank" rel="noopener noreferrer">
                {t('museum.book')}
              </a>
            </>
          )}
        </span>
      )}
      {rule.note && <span className={styles.note}>{rule.note}</span>}
    </li>
  );
}
