import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import type { Museum } from '@/lib/types';
import { CATEGORY_COLORS, deriveCategories } from '@/lib/categories';
import { isClosedOn, isFreeOn, nextFreeDate } from '@/lib/freeRules';
import { COUNTRY } from '@/countries';
import { normalizeLocale } from '@/lib/i18n';
import { formatOpeningHours } from '@/lib/openingHours';
import { haversineKm } from '@/lib/distance';
import { formatDate, formatKm, formatPrice, formatYear } from '@/lib/format';
import CopyLinkDialog from './CopyLinkDialog';
import RuleExplanation from './RuleExplanation';
import styles from './DetailPanel.module.css';

interface DetailPanelProps {
  museum: Museum;
  onBack: () => void;
}

/** Museum detail styled like a gallery wall label. */
export default function DetailPanel({ museum, onBack }: DetailPanelProps) {
  const { t, i18n } = useTranslation();
  const { ctx, content, notes, filters, today } = useAppState();
  const locale = i18n.language;
  const [copied, setCopied] = useState<'link' | 'address' | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClampable, setDescClampable] = useState(false);
  const descRef = useRef<HTMLParagraphElement | null>(null);

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

  useEffect(() => {
    setDescExpanded(false);
  }, [museum.id]);

  // The more/less toggle only appears when the text actually exceeds 3 lines.
  useEffect(() => {
    const el = descRef.current;
    if (!el || !description) {
      setDescClampable(false);
      return;
    }
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      if (Number.isFinite(lineHeight)) {
        setDescClampable(el.scrollHeight > lineHeight * 3 + 2);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [description]);

  const categories = deriveCategories(museum);
  const photoUrl = museum.image
    ? `${import.meta.env.BASE_URL}${museum.image.file}`
    : undefined;
  const freeToday = isFreeOn(museum, today, ctx);
  const closedToday = isClosedOn(museum, today);
  const next = nextFreeDate(museum, today, ctx);
  const distance = filters.center ? haversineKm(filters.center, museum.coordinates) : null;
  const showFrench =
    localized !== undefined && localized !== museum.name && normalizeLocale(locale) !== COUNTRY.canonicalLocale;

  const eyebrow =
    museum.arrondissement !== undefined
      ? `${t('filters.arrondissementLabel', { number: museum.arrondissement })} · ${museum.commune}`
      : `${museum.commune} · ${COUNTRY.adminAreas.names[museum.department]}`;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${museum.coordinates[1]},${museum.coordinates[0]}`;
  // Name + address query lands on the Google Maps place card (with hours and
  // reviews), unlike a bare coordinate pin.
  const placeQuery = [museum.name, museum.address, `${museum.postalCode} ${museum.commune}`]
    .filter(Boolean)
    .join(', ');
  const placeUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(museum.name)}&sll=${museum.coordinates[1]},${museum.coordinates[0]}&z=16`;
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}museum/${museum.id}`;
  const fullAddress = [museum.address, `${museum.postalCode} ${museum.commune}`]
    .filter(Boolean)
    .join(', ');

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied('link');
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(fullAddress);
    setCopied('address');
  }

  const sources = [
    ...new Map(
      [
        ...museum.freeAccess.map((r) => r.source),
        ...(museum.openingHoursSource ? [museum.openingHoursSource] : []),
      ].map((s) => [s.url, s]),
    ).values(),
  ];

  return (
    <article className={styles.panel} aria-label={localized ?? museum.name}>
      <button type="button" className={styles.back} onClick={onBack}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={styles.backIcon}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8L2 12L6 16" />
          <path d="M2 12H22" />
        </svg>
        {t('museum.back')}
      </button>

      <header
        className={photoUrl ? `${styles.header} ${styles.headerPhoto}` : styles.header}
        style={
          photoUrl
            ? { backgroundImage: `url(${photoUrl})` }
            : { borderInlineStartColor: CATEGORY_COLORS[categories[0]] }
        }
      >
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.name}>{localized ?? museum.name}</h2>
        {showFrench && (
          <p className={styles.frenchName}>
            <span className={styles.frenchLabel}>{t(COUNTRY.canonicalLocale === 'fr' ? 'museum.frenchName' : 'museum.originalName')}</span>
            {museum.name}
          </p>
        )}
        {museum.note && <p className={styles.note}>{notes[museum.note] ?? museum.note}</p>}
        <div className={styles.headerBottom}>
          <div className={styles.actions}>
            {museum.website && (
              <a
                className={styles.iconAction}
                href={museum.website}
                target="_blank"
                rel="noopener noreferrer"
                title={t('museum.website')}
                aria-label={t('museum.website')}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                  <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </a>
            )}
            {museum.wikipedia && (
              <a
                className={styles.iconAction}
                href={museum.wikipedia}
                target="_blank"
                rel="noopener noreferrer"
                title={t('museum.wikipedia')}
                aria-label={t('museum.wikipedia')}
              >
                <svg viewBox="0 0 128 128" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M 120.85,29.21 C 120.85,29.62 120.72,29.99 120.47,30.33 C 120.21,30.66 119.94,30.83 119.63,30.83 C 117.14,31.07 115.09,31.87 113.51,33.24 C 111.92,34.6 110.29,37.21 108.6,41.05 L 82.8,99.19 C 82.63,99.73 82.16,100 81.38,100 C 80.77,100 80.3,99.73 79.96,99.19 L 65.49,68.93 L 48.85,99.19 C 48.51,99.73 48.04,100 47.43,100 C 46.69,100 46.2,99.73 45.96,99.19 L 20.61,41.05 C 19.03,37.44 17.36,34.92 15.6,33.49 C 13.85,32.06 11.4,31.17 8.27,30.83 C 8,30.83 7.74,30.69 7.51,30.4 C 7.27,30.12 7.15,29.79 7.15,29.42 C 7.15,28.47 7.42,28 7.96,28 C 10.22,28 12.58,28.1 15.05,28.3 C 17.34,28.51 19.5,28.61 21.52,28.61 C 23.58,28.61 26.01,28.51 28.81,28.3 C 31.74,28.1 34.34,28 36.6,28 C 37.14,28 37.41,28.47 37.41,29.42 C 37.41,30.36 37.24,30.83 36.91,30.83 C 34.65,31 32.87,31.58 31.57,32.55 C 30.27,33.53 29.62,34.81 29.62,36.4 C 29.62,37.21 29.89,38.22 30.43,39.43 L 51.38,86.74 L 63.27,64.28 L 52.19,41.05 C 50.2,36.91 48.56,34.23 47.28,33.03 C 46,31.84 44.06,31.1 41.46,30.83 C 41.22,30.83 41,30.69 40.78,30.4 C 40.56,30.12 40.45,29.79 40.45,29.42 C 40.45,28.47 40.68,28 41.16,28 C 43.42,28 45.49,28.1 47.38,28.3 C 49.2,28.51 51.14,28.61 53.2,28.61 C 55.22,28.61 57.36,28.51 59.62,28.3 C 61.95,28.1 64.24,28 66.5,28 C 67.04,28 67.31,28.47 67.31,29.42 C 67.31,30.36 67.15,30.83 66.81,30.83 C 62.29,31.14 60.03,32.42 60.03,34.68 C 60.03,35.69 60.55,37.26 61.6,39.38 L 68.93,54.26 L 76.22,40.65 C 77.23,38.73 77.74,37.11 77.74,35.79 C 77.74,32.69 75.48,31.04 70.96,30.83 C 70.55,30.83 70.35,30.36 70.35,29.42 C 70.35,29.08 70.45,28.76 70.65,28.46 C 70.86,28.15 71.06,28 71.26,28 C 72.88,28 74.87,28.1 77.23,28.3 C 79.49,28.51 81.35,28.61 82.8,28.61 C 83.84,28.61 85.38,28.52 87.4,28.35 C 89.96,28.12 92.11,28 93.83,28 C 94.23,28 94.43,28.4 94.43,29.21 C 94.43,30.29 94.06,30.83 93.32,30.83 C 90.69,31.1 88.57,31.83 86.97,33.01 C 85.37,34.19 83.37,36.87 80.98,41.05 L 71.26,59.02 L 84.42,85.83 L 103.85,40.65 C 104.52,39 104.86,37.48 104.86,36.1 C 104.86,32.79 102.6,31.04 98.08,30.83 C 97.67,30.83 97.47,30.36 97.47,29.42 C 97.47,28.47 97.77,28 98.38,28 C 100.03,28 101.99,28.1 104.25,28.3 C 106.34,28.51 108.1,28.61 109.51,28.61 C 111,28.61 112.72,28.51 114.67,28.3 C 116.7,28.1 118.52,28 120.14,28 C 120.61,28 120.85,28.4 120.85,29.21 z"
                  />
                </svg>
              </a>
            )}
            <button
              type="button"
              className={styles.iconAction}
              onClick={() => void copyLink()}
              title={t('museum.copyLink')}
              aria-label={t('museum.copyLink')}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
          </div>
          {museum.image && (
            <details className={styles.creditToggle}>
              <summary
                className={styles.creditButton}
                title={t('museum.photoCreditToggle')}
                aria-label={t('museum.photoCreditToggle')}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={styles.creditIcon}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </summary>
              <a
                className={styles.credit}
                href={museum.image.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('museum.photoCredit', {
                  author: museum.image.author,
                  license: museum.image.license,
                })}
              </a>
            </details>
          )}
        </div>
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('museum.freeAccessTitle')}</h3>
        {museum.freeAccess.length === 0 ? (
          <p className={styles.noScheme}>{t('museum.noFreeScheme')}</p>
        ) : (
          <>
            {freeToday ? (
              <p
                className={
                  closedToday ? styles.status : `${styles.status} ${styles.statusToday}`
                }
              >
                {closedToday ? t('museum.todayFreeButClosed') : t('museum.todayFree')}
              </p>
            ) : (
              next && (
                <p className={styles.status}>
                  {t('museum.nextFreeDate', { date: formatDate(locale, next.date) })}
                  {next.estimated && ` (${t('museum.estimated')})`}
                </p>
              )
            )}
            <ul className={styles.rules}>
              {museum.freeAccess.map((rule, i) => (
                <RuleExplanation key={i} rule={rule} />
              ))}
            </ul>
            {museum.closedUntil && today < museum.closedUntil && (
              <p className={styles.status}>
                {t('museum.reopens', {
                  date:
                    museum.closedUntil.length === 4
                      ? formatYear(locale, museum.closedUntil)
                      : formatDate(locale, museum.closedUntil),
                })}
              </p>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('museum.address')}</h3>
        <p className={styles.address}>
          <button
            type="button"
            className={styles.addressCopy}
            onClick={() => void copyAddress()}
            title={t('museum.copyAddress')}
          >
            {fullAddress}
          </button>
          {distance !== null && (
            <span className={styles.distance}>
              {' · '}
              {t('museum.distanceAway', { km: formatKm(locale, distance) })}
            </span>
          )}
          <span className={styles.mapActions}>
            <a
              className={styles.iconAction}
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t('museum.directions')}
              aria-label={t('museum.directions')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.38.39-1.02 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"
                />
              </svg>
            </a>
            <a
              className={styles.iconAction}
              href={placeUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t('museum.googleMaps')}
              aria-label={t('museum.googleMaps')}
            >
              {/* Place pin — the Google Maps brand mark shape. */}
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M50,5C32.6,5,18.5,19.1,18.5,36.5c0,6.8,2.2,14.6,5.9,19.8L50,95l25.6-38.7c3.7-5.2,5.9-12.9,5.9-19.8C81.5,19.1,67.4,5,50,5z M50,48.5c-6.6,0-12-5.4-12-12c0-6.6,5.4-12,12-12s12,5.4,12,12C62,43.1,56.6,48.5,50,48.5z"
                />
              </svg>
            </a>
            <a
              className={styles.iconAction}
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t('museum.appleMaps')}
              aria-label={t('museum.appleMaps')}
            >
              <svg viewBox="0 0 814 1000" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
                />
              </svg>
            </a>
          </span>
        </p>
        {museum.openingHours && (
          <>
            <h3 className={styles.sectionTitle}>{t('museum.openingHours')}</h3>
            <p className={styles.hours}>
              {formatOpeningHours(museum.openingHours, locale, {
                closed: t('museum.hoursClosed'),
                publicHolidays: t('museum.hoursPublicHolidays'),
                always: t('museum.hoursAlways'),
              })}
            </p>
          </>
        )}
        {museum.wheelchair && (
          <>
            <h3 className={styles.sectionTitle}>{t('museum.accessibilityTitle')}</h3>
            <p className={styles.hours}>
              {t(
                museum.wheelchair === 'yes'
                  ? 'museum.wheelchairYes'
                  : museum.wheelchair === 'partial'
                    ? 'museum.wheelchairPartial'
                    : 'museum.wheelchairNo',
              )}
            </p>
          </>
        )}
        {museum.admission && (
          <>
            <h3 className={styles.sectionTitle}>{t('museum.admissionTitle')}</h3>
            <p className={styles.hours}>
              {t('museum.admissionFull', {
                price: formatPrice(locale, museum.admission.full, museum.admission.currency),
              })}
              {museum.admission.reduced !== undefined &&
                `${t('museum.admissionSeparator')}${t('museum.admissionReduced', {
                  price: formatPrice(locale, museum.admission.reduced, museum.admission.currency),
                })}`}
            </p>
          </>
        )}
      </section>

      {description && (
        <section className={styles.section}>
          <p
            ref={descRef}
            className={
              descClampable && !descExpanded
                ? `${styles.description} ${styles.descriptionClamped}`
                : styles.description
            }
          >
            {description}
          </p>
          {descClampable && (
            <button
              type="button"
              className={styles.moreToggle}
              aria-expanded={descExpanded}
              onClick={() => setDescExpanded((v) => !v)}
            >
              {descExpanded ? t('museum.readLess') : t('museum.readMore')}
            </button>
          )}
        </section>
      )}

      {sources.length > 0 && (
        <footer className={styles.sources}>
          <details>
            <summary className={styles.sourceSummary}>
              <span className={styles.sectionTitle}>{t('museum.source')}</span>
            </summary>
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
          </details>
        </footer>
      )}

      {copied && (
        <CopyLinkDialog
          message={t(copied === 'address' ? 'museum.addressCopied' : 'museum.linkCopied')}
          onClose={() => setCopied(null)}
        />
      )}
    </article>
  );
}
