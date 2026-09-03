import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { EventDates, Museum } from '@/lib/types';
import type { MuseumContentMap } from '@/lib/localeData';
import { CATEGORY_COLORS, deriveCategories } from '@/lib/categories';
import { COUNTRY } from '@/countries';
import { normalizeLocale } from '@/lib/i18n';
import { formatOpeningHours } from '@/lib/openingHours';
import { formatDate, formatKm, formatPrice, formatYear } from '@/lib/format';
import { CategoryBadgeContent } from './CategoryBadge';
import RuleExplanation from './RuleExplanation';
import styles from './DetailPanel.module.css';

export interface DetailContentProps {
  museum: Museum;
  content: MuseumContentMap;
  notes: Record<string, string>;
  locale: string;
  t: TFunction;
  baseUrl: string;
  /** Enable date-sensitive extras (per-event next dates); SPA only. */
  today?: string;
  events?: EventDates;
  dateStatus?: ReactNode;
  distanceKm?: number | null;
  onBack?: () => void;
  backHref?: string;
  mapHref?: string;
  headerImage?: {
    src: string;
    width: number;
    height: number;
    alt: string;
  };
  nearby?: {
    heading: string;
    items: {
      id: string;
      href: string;
      name: string;
      commune: string;
      category: ReturnType<typeof deriveCategories>[number];
      categoryLabel: string;
    }[];
    moreLinks: { href: string; label: string }[];
  };
  onCopyLink?: () => void;
  onCopyAddress?: () => void;
}

/**
 * Pure museum-detail presentation shared by the SPA panel and Astro pages.
 * Date-sensitive content is supplied separately through `dateStatus`.
 */
export default function DetailContent({
  museum,
  content,
  notes,
  locale,
  t,
  baseUrl,
  today,
  events,
  dateStatus,
  distanceKm = null,
  onBack,
  backHref,
  mapHref,
  headerImage,
  nearby,
  onCopyLink,
  onCopyAddress,
}: DetailContentProps) {
  const entry = content[museum.id];
  const localized = entry?.name;
  const description = entry?.description;
  // Clamp state is SPA-only by construction: effects never run during the
  // static build render, so generated HTML always carries the full text.
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClampable, setDescClampable] = useState(false);
  const descRef = useRef<HTMLParagraphElement | null>(null);

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
    ? `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${museum.image.file.replace(/^\//, '')}`
    : undefined;
  const showOriginal =
    localized !== undefined &&
    localized !== museum.name &&
    normalizeLocale(locale) !== COUNTRY.canonicalLocale;
  const adminArea = COUNTRY.adminAreas.names[museum.department];
  const eyebrow =
    museum.arrondissement !== undefined
      ? `${t('filters.arrondissementLabel', { number: museum.arrondissement })} · ${museum.commune}`
      : [museum.commune, adminArea].filter(Boolean).join(' · ');
  const fullAddress = [museum.address, `${museum.postalCode} ${museum.commune}`]
    .filter(Boolean)
    .join(', ');
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${museum.coordinates[1]},${museum.coordinates[0]}`;
  const placeQuery = [museum.name, museum.address, `${museum.postalCode} ${museum.commune}`]
    .filter(Boolean)
    .join(', ');
  const placeUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(museum.name)}&sll=${museum.coordinates[1]},${museum.coordinates[0]}&z=16`;
  const sources = [
    ...new Map(
      [
        ...museum.freeAccess.map((rule) => rule.source),
        ...(museum.openingHoursSource ? [museum.openingHoursSource] : []),
      ].map((source) => [source.url, source]),
    ).values(),
  ];

  return (
    <article className={styles.panel} aria-label={localized ?? museum.name}>
      {onBack ? (
        <button type="button" className={styles.back} onClick={onBack}>
          ← {t('museum.back')}
        </button>
      ) : (
        backHref && (
          <a className={styles.back} href={backHref}>
            ← {t('museum.back')}
          </a>
        )
      )}

      <header
        className={photoUrl ? `${styles.header} ${styles.headerPhoto}` : styles.header}
        style={
          photoUrl && !headerImage
            ? { backgroundImage: `url(${photoUrl})` }
            : { borderInlineStartColor: CATEGORY_COLORS[categories[0]] }
        }
      >
        {headerImage && (
          <img
            className={styles.headerImage}
            src={headerImage.src}
              alt={headerImage.alt}
              width={headerImage.width}
              height={headerImage.height}
              decoding="async"
              {...{ fetchpriority: 'high' }}
            />
        )}
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.name}>{localized ?? museum.name}</h1>
        {showOriginal && (
          <p className={styles.frenchName}>
            <span className={styles.frenchLabel}>
              {t(
                COUNTRY.canonicalLocale === 'fr'
                  ? 'museum.frenchName'
                  : 'museum.originalName',
              )}
            </span>
            {museum.name}
          </p>
        )}
        {museum.note && <p className={styles.note}>{notes[museum.note] ?? museum.note}</p>}
        <div className={styles.headerBottom}>
          <div className={styles.actions}>
            {mapHref && (
              <a className={styles.actionPrimary} href={mapHref}>
                {t('museum.seeOnMap')}
              </a>
            )}
            {museum.website && (
              <a className={styles.action} href={museum.website} target="_blank" rel="noopener noreferrer">
                {t('museum.website')}
              </a>
            )}
            {museum.wikipedia && (
              <a className={styles.action} href={museum.wikipedia} target="_blank" rel="noopener noreferrer">
                {t('museum.wikipedia')}
              </a>
            )}
            {onCopyLink && (
              <button type="button" className={styles.action} onClick={onCopyLink}>
                {t('museum.copyLink')}
              </button>
            )}
          </div>
          {museum.image && (
            <details className={styles.creditToggle}>
              <summary className={styles.creditButton} aria-label={t('museum.photoCreditToggle')}>
                ⓘ
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

      <div className={styles.actions} aria-label={t('filters.freeType')}>
        {categories.map((category) => (
          <CategoryBadgeContent
            key={category}
            category={category}
            label={t(`categories.${category}`)}
          />
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('museum.freeAccessTitle')}</h2>
        {dateStatus}
        {museum.freeAccess.length === 0 ? (
          <p className={styles.noScheme}>{t('museum.noFreeScheme')}</p>
        ) : (
          <ul className={styles.rules}>
            {museum.freeAccess.map((rule, index) => (
              <RuleExplanation
                key={index}
                rule={rule}
                locale={locale}
                notes={notes}
                t={t}
                today={today}
                events={events}
              />
            ))}
          </ul>
        )}
        {museum.closedUntil && (
          <p className={styles.status}>
            {t('museum.reopens', {
              date:
                museum.closedUntil.length === 4
                  ? formatYear(locale, museum.closedUntil)
                  : formatDate(locale, museum.closedUntil),
            })}
          </p>
        )}
        {(museum.closures ?? []).map((closure) => (
          <p className={styles.hours} key={`${closure.from}-${closure.to}`}>
            {t('museum.hoursClosed')}: {formatDate(locale, closure.from)} –{' '}
            {formatDate(locale, closure.to)}
          </p>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('museum.address')}</h2>
        <p className={styles.address}>
          {onCopyAddress ? (
            <button
              type="button"
              className={styles.addressCopy}
              onClick={onCopyAddress}
              title={t('museum.copyAddress')}
            >
              {fullAddress}
            </button>
          ) : (
            <span>{fullAddress}</span>
          )}
          {distanceKm !== null && (
            <span className={styles.distance}>
              {' · '}
              {t('museum.distanceAway', { km: formatKm(locale, distanceKm) })}
            </span>
          )}
        </p>
        <p className={styles.actions}>
          <a className={styles.action} href={directionsUrl} target="_blank" rel="noopener noreferrer">
            {t('museum.directions')}
          </a>
          <a className={styles.action} href={placeUrl} target="_blank" rel="noopener noreferrer">
            {t('museum.googleMaps')}
          </a>
          <a className={styles.action} href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
            {t('museum.appleMaps')}
          </a>
        </p>
        {museum.openingHours && (
          <>
            <h2 className={styles.sectionTitle}>{t('museum.openingHours')}</h2>
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
            <h2 className={styles.sectionTitle}>{t('museum.accessibilityTitle')}</h2>
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
            <h2 className={styles.sectionTitle}>{t('museum.admissionTitle')}</h2>
            <p className={styles.hours}>
              {t('museum.admissionFull', {
                price: formatPrice(locale, museum.admission.full, museum.admission.currency),
              })}
              {museum.admission.reduced !== undefined &&
                `${t('museum.admissionSeparator')}${t('museum.admissionReduced', {
                  price: formatPrice(
                    locale,
                    museum.admission.reduced,
                    museum.admission.currency,
                  ),
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

      {nearby && nearby.items.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.nearbyTitle}>{nearby.heading}</h2>
          <ul className={styles.nearbyList}>
            {nearby.items.map((item) => (
              <li key={item.id}>
                <a className={styles.nearbyLink} href={item.href}>
                  <span className={styles.nearbyName}>{item.name}</span>
                  <span className={styles.nearbyPlace}>{item.commune}</span>
                  <CategoryBadgeContent
                    category={item.category}
                    label={item.categoryLabel}
                  />
                </a>
              </li>
            ))}
          </ul>
          {nearby.moreLinks.length > 0 && (
            <p className={styles.moreNearby}>
              {nearby.moreLinks.map((link) => (
                <a key={link.href} href={link.href}>{link.label}</a>
              ))}
            </p>
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
    </article>
  );
}
