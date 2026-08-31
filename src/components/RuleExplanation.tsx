import type { TFunction } from 'i18next';
import type { EventDates, FreeRule } from '@/lib/types';
import { eventDatesForYear } from '@/lib/freeRules';
import { ruleCategory } from '@/lib/categories';
import { annualDateName, formatDate, monthName, weekdayName } from '@/lib/format';
import { CategoryBadgeContent } from './CategoryBadge';
import styles from './RuleExplanation.module.css';

interface RuleExplanationProps {
  rule: FreeRule;
  locale: string;
  notes: Record<string, string>;
  t: TFunction;
  /** When both are given, event rules gain their next concrete date. The
   *  static build omits them so today's date is never frozen into HTML. */
  today?: string;
  events?: EventDates;
}

/** One free-access rule as a plain-language sentence in the given locale. */
export default function RuleExplanation({
  rule,
  locale,
  notes,
  t,
  today,
  events,
}: RuleExplanationProps) {
  let sentence = '';
  let estimated = false;
  let eventNext: string | null = null;

  switch (rule.kind) {
    case 'weekly':
      sentence = t('rules.weekly', { weekday: weekdayName(locale, rule.weekday ?? 'sunday') });
      if (rule.evening) sentence += `, ${t('rules.evening')}`;
      break;
    case 'always':
      sentence =
        rule.audience === 'under-26-eu'
          ? t('rules.alwaysUnder26')
          : rule.audience === 'under-26'
            ? t('rules.alwaysUnder26All')
            : rule.audience === 'under-18'
              ? t('rules.alwaysUnder18')
              : rule.audience && rule.audience !== 'everyone' && rule.audience !== 'residents'
                ? t('rules.alwaysForAudience', { audience: t(`audiences.${rule.audience}`) })
                : t('rules.always');
      if (rule.months && rule.months.length > 0) {
        sentence += `, ${t('rules.monthsRange', {
          from: monthName(locale, rule.months[0]),
          to: monthName(locale, rule.months[rule.months.length - 1]),
        })}`;
      }
      break;
    case 'nth-weekday':
      sentence = t(rule.nth === -1 ? 'rules.lastWeekday' : 'rules.firstWeekday', {
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
    case 'annual-date':
      sentence =
        rule.date === '07-14'
          ? t('rules.july14')
          : t('rules.annualDate', { date: annualDateName(locale, rule.date ?? '') });
      break;
    case 'event':
      sentence = rule.event === 'museum-night' ? t('rules.museumNight') : t('rules.heritageDays');
      if (rule.event && today && events) {
        const year = Number(today.slice(0, 4));
        for (const y of [year, year + 1]) {
          const info = eventDatesForYear(events, rule.event, y);
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

  if (rule.scope === 'grounds') sentence += t('rules.scopeGrounds');
  else if (rule.scope === 'permanent-collection') sentence += t('rules.scopePermanentCollection');
  else if (rule.scope === 'partial') sentence += t('rules.scopePartial');
  if (rule.audience === 'residents') sentence += t('rules.residentsOnly');

  const localizedNote = rule.note ? notes[rule.note] ?? rule.note : undefined;
  const replacing = rule.noteReplacesSentence === true && localizedNote !== undefined;
  const category = ruleCategory(rule);

  return (
    <li className={styles.rule}>
      <span className={styles.ruleLine}>
        <CategoryBadgeContent category={category} label={t(`categories.${category}`)} />
        <span className={styles.sentence}>
          {replacing ? localizedNote : sentence}
          {eventNext && (
            <span className={styles.next}>
              {' '}
              ({t('rules.nextDate', { date: formatDate(locale, eventNext) })}
              {estimated ? `, ${t('museum.estimated')}` : ''})
            </span>
          )}
        </span>
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
      {localizedNote && !replacing && <span className={styles.note}>{localizedNote}</span>}
    </li>
  );
}
