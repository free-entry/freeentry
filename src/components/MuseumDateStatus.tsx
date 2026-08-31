import { useEffect, useState } from 'react';
import { createInstance, type TFunction } from 'i18next';
import { COUNTRY_CODE } from '@/countries';
import { normalizeLocale } from '@/lib/i18n';
import type { EventDates, Museum } from '@/lib/types';
import type { RuleContext } from '@/lib/freeRules';
import { isClosedOn, isFreeOn, nextFreeDate } from '@/lib/freeRules';
import { formatDate } from '@/lib/format';
import styles from './DetailPanel.module.css';

const eventModules = import.meta.glob<{ default: EventDates }>('../../data/*/events.json', {
  eager: true,
});
const translationModules = import.meta.glob<{ default: Record<string, unknown> }>(
  '../locales/*.json',
);

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

interface DateStatusContentProps {
  museum: Museum;
  locale: string;
  today: string;
  ctx: RuleContext;
  t: TFunction;
}

/** Pure date-sensitive status; callers decide when it is safe to render. */
export function DateStatusContent({ museum, locale, today, ctx, t }: DateStatusContentProps) {
  const freeToday = isFreeOn(museum, today, ctx);
  const closedToday = isClosedOn(museum, today);
  const next = freeToday ? null : nextFreeDate(museum, today, ctx);

  if (freeToday) {
    return (
      <p className={closedToday ? styles.status : `${styles.status} ${styles.statusToday}`}>
        {closedToday ? t('museum.todayFreeButClosed') : t('museum.todayFree')}
      </p>
    );
  }
  if (!next) return null;
  return (
    <p className={styles.status}>
      {t('museum.nextFreeDate', { date: formatDate(locale, next.date) })}
      {next.estimated && ` (${t('museum.estimated')})`}
    </p>
  );
}

/**
 * Hydrated detail-page island. Its server render is deliberately empty so
 * today's status is never frozen into generated museum HTML.
 */
export default function MuseumDateStatus({ museum, locale }: { museum: Museum; locale: string }) {
  const [translator, setTranslator] = useState<TFunction | null>(null);
  const normalized = normalizeLocale(locale);

  useEffect(() => {
    let cancelled = false;
    const loader = translationModules[`../locales/${normalized}.json`];
    if (!loader) return;
    void loader().then(async ({ default: resource }) => {
      const instance = createInstance();
      await instance.init({
        lng: normalized,
        fallbackLng: 'fr',
        initImmediate: false,
        resources: { [normalized]: { translation: resource } },
        interpolation: { escapeValue: false },
        returnNull: false,
      });
      if (!cancelled) setTranslator(() => instance.t.bind(instance));
    });
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  if (!translator) return <div data-date-status aria-live="polite" />;
  const events = eventModules[`../../data/${COUNTRY_CODE}/events.json`]?.default ?? {};
  return (
    <div data-date-status aria-live="polite">
      <DateStatusContent
        museum={museum}
        locale={normalized}
        today={localToday()}
        ctx={{ events, audiences: [] }}
        t={translator}
      />
    </div>
  );
}
