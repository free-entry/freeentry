import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import type { Museum } from '@/lib/types';
import { CATEGORY_COLORS, deriveCategory } from '@/lib/categories';
import { isFreeOn, nextFreeDate } from '@/lib/freeRules';
import { haversineKm } from '@/lib/distance';
import { formatDate, formatKm } from '@/lib/format';
import CategoryBadge from './CategoryBadge';
import RuleExplanation from './RuleExplanation';
import { DEPARTMENT_NAMES } from './AreaFilter';
import styles from './DetailPanel.module.css';

interface DetailPanelProps {
  museum: Museum;
  onBack: () => void;
}

/** Museum detail styled like a gallery wall label. */
export default function DetailPanel({ museum, onBack }: DetailPanelProps) {
  const { t, i18n } = useTranslation();
  const { ctx, content, filters, today } = useAppState();
  const locale = i18n.language;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const entry = content[museum.id];
  const localized = entry?.name;
  const description = entry?.description;
  const category = deriveCategory(museum);
  const freeToday = isFreeOn(museum, today, ctx);
  const next = nextFreeDate(museum, today, ctx);
  const distance = filters.center ? haversineKm(filters.center, museum.coordinates) : null;
  const showFrench = localized !== undefined && localized !== museum.name;

  const eyebrow =
    museum.arrondissement !== undefined
      ? `${t('filters.arrondissementLabel', { number: museum.arrondissement })} · Paris`
      : `${museum.commune} · ${DEPARTMENT_NAMES[museum.department]}`;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${museum.coordinates[1]},${museum.coordinates[0]}`;
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}museum/${museum.id}`;

  async function share() {
    const title = localized ?? museum.name;
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    await navigator.clipboard.writeText(shareUrl);
    window.alert(t('museum.linkCopied'));
  }

  const sources = [
    ...new Map(
      museum.freeAccess.map((r) => [r.source.url, r.source]),
    ).values(),
  ];

  return (
    <article className={styles.panel} aria-label={localized ?? museum.name}>
      <button type="button" className={styles.back} onClick={onBack}>
        ← {t('museum.back')}
      </button>

      <header
        className={styles.header}
        style={{ borderInlineStartColor: CATEGORY_COLORS[category] }}
      >
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.name}>{localized ?? museum.name}</h2>
        {showFrench && (
          <p className={styles.frenchName}>
            <span className={styles.frenchLabel}>{t('museum.frenchName')}: </span>
            {museum.name}
          </p>
        )}
        <div className={styles.badges}>
          <CategoryBadge category={category} />
          {freeToday && <span className={styles.today}>{t('museum.todayFree')}</span>}
        </div>
      </header>

      {description && <p className={styles.description}>{description}</p>}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('museum.freeAccessTitle')}</h3>
        {museum.freeAccess.length === 0 ? (
          <p className={styles.noScheme}>{t('museum.noFreeScheme')}</p>
        ) : (
          <>
            {next && !freeToday && (
              <p className={styles.nextDate}>
                {t('museum.nextFreeDate', { date: formatDate(locale, next.date) })}
                {next.estimated && ` (${t('museum.estimated')})`}
              </p>
            )}
            <ul className={styles.rules}>
              {museum.freeAccess.map((rule, i) => (
                <RuleExplanation key={i} rule={rule} />
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('museum.address')}</h3>
        <p className={styles.address}>
          {museum.address && <>{museum.address}<br /></>}
          {museum.postalCode} {museum.commune}
          {distance !== null && (
            <span className={styles.distance}>
              {' · '}
              {t('museum.distanceAway', { km: formatKm(locale, distance) })}
            </span>
          )}
        </p>
        {museum.openingHours && (
          <p className={styles.hours}>
            <strong>{t('museum.openingHours')}: </strong>
            {museum.openingHours}
          </p>
        )}
        <div className={styles.actions}>
          <a
            className={styles.actionPrimary}
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('museum.directions')}
          </a>
          {museum.website && (
            <a
              className={styles.action}
              href={museum.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('museum.website')}
            </a>
          )}
          <button type="button" className={styles.action} onClick={() => void share()}>
            {t('museum.share')}
          </button>
        </div>
      </section>

      {sources.length > 0 && (
        <footer className={styles.sources}>
          <h3 className={styles.sectionTitle}>{t('museum.source')}</h3>
          <ul className={styles.sourceList}>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {new URL(source.url).hostname}
                </a>{' '}
                <span className={styles.checked}>
                  ({t('museum.checkedOn', { date: formatDate(locale, source.checkedAt, false) })})
                </span>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
