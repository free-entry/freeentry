import type { TFunction } from 'i18next';
import { COUNTRY } from '@/countries';
import { parseOpeningHours } from './openingHours';
import { LOCALES, type Locale } from './i18n';
import type { Museum, MuseumContent } from './types';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import es from '@/locales/es.json';
import it from '@/locales/it.json';
import de from '@/locales/de.json';
import zhHans from '@/locales/zh-Hans.json';
import zhHant from '@/locales/zh-Hant.json';
import ja from '@/locales/ja.json';
import ko from '@/locales/ko.json';
import ar from '@/locales/ar.json';

export interface HreflangLink {
  hreflang: string;
  href: string;
}

export interface SeoBreadcrumb {
  name: string;
  path: string;
}

export interface MuseumSeo {
  title: string;
  description: string;
  canonicalPath: string;
  alternates: HreflangLink[];
  jsonLd: Record<string, unknown>[];
}

export interface HubSeo {
  title: string;
  description: string;
  canonicalPath: string;
  alternates: HreflangLink[];
  jsonLd: Record<string, unknown>[];
}

export interface HomeSeo {
  title: string;
  description: string;
  canonicalPath: string;
  alternates: HreflangLink[];
  jsonLd: Record<string, unknown>;
}

export type HubKind = 'index' | 'area' | 'city' | 'category';

const COUNTRY_NAMES: Record<string, string> = {
  fr: 'France',
  it: 'Italy',
  be: 'Belgium',
};

const UI_BUNDLES = { en, fr, es, it, de, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, ar };

export function localePrefix(locale: Locale): string {
  return locale === 'en' ? '' : `${locale}/`;
}

export function homePath(locale: Locale): string {
  return `/${localePrefix(locale)}`;
}

export function detailPath(id: string, locale: Locale): string {
  return `/${localePrefix(locale)}museum/${id}/`;
}

export function hubPath(kind: HubKind, slug: string | undefined, locale: Locale): string {
  const segment = kind === 'index' ? 'museums' : kind === 'category' ? 'free' : kind;
  return `/${localePrefix(locale)}${segment}/${slug ? `${slug}/` : ''}`;
}

export function alternatesFor(pathBuilder: (locale: Locale) => string): HreflangLink[] {
  const links: HreflangLink[] = LOCALES.map((locale) => ({
    hreflang: locale,
    href: `${COUNTRY.siteUrl}${pathBuilder(locale)}`,
  }));
  links.push({ hreflang: 'x-default', href: `${COUNTRY.siteUrl}${pathBuilder('en')}` });
  return links;
}

export function detailAlternates(id: string): HreflangLink[] {
  return alternatesFor((locale) => detailPath(id, locale));
}

export function homeAlternates(): HreflangLink[] {
  return alternatesFor(homePath);
}

export function homeSeo(locale: Locale): HomeSeo {
  const app = UI_BUNDLES[locale].app;
  const brand = COUNTRY.brand?.[locale];
  const title = brand?.title ?? app.title;
  const titleShort = brand?.titleShort ?? app.titleShort;
  const description = brand?.metaDescription ?? app.metaDescription;
  const canonicalPath = homePath(locale);
  const url = absoluteUrl(canonicalPath);

  return {
    title,
    description,
    canonicalPath,
    alternates: homeAlternates(),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: titleShort,
      url,
      inLanguage: locale,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${url}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  };
}

export function freeSummary(museum: Museum, locale: Locale, t: TFunction): string {
  const kinds = new Set(museum.freeAccess.map((rule) => rule.kind));
  if (locale === 'en') {
    if (museum.freeAccess.some((rule) => rule.kind === 'always' && !rule.audience)) {
      return 'Free admission';
    }
    if (kinds.has('nth-weekday')) return 'Free on selected days each month';
    if (kinds.has('event') || kinds.has('annual-date')) return 'Free on special days';
    return `Museum in ${COUNTRY_NAMES[COUNTRY.code]}`;
  }
  if (museum.freeAccess.some((rule) => rule.kind === 'always' && !rule.audience)) {
    return t('rules.always');
  }
  if (kinds.has('nth-weekday')) return t('categories.first-sunday');
  if (kinds.has('event') || kinds.has('annual-date')) return t('categories.special-days');
  return t('museum.freeAccessTitle');
}

function truncateDescription(value: string, locale: Locale): string {
  const limit = ['zh-Hans', 'zh-Hant', 'ja', 'ko'].includes(locale) ? 78 : 155;
  if (value.length <= limit) return value;
  const slice = value.slice(0, limit - 1);
  const boundary = slice.search(/\s+\S*$/);
  const truncated = boundary > 0 ? slice.slice(0, boundary) : slice;
  return `${truncated.trimEnd()}…`;
}

function absoluteUrl(path: string): string {
  return `${COUNTRY.siteUrl}${path}`;
}

function breadcrumbJsonLd(items: SeoBreadcrumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

function equivalentName(a: string, b: string): boolean {
  const normalize = (value: string) => value.normalize('NFKC').replace(/’/g, "'");
  return normalize(a) === normalize(b);
}

function googleMapsPlaceUrl(museum: Museum): string {
  const query = [museum.name, museum.address, `${museum.postalCode} ${museum.commune}`]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function museumSeo(
  museum: Museum,
  entry: MuseumContent | undefined,
  locale: Locale,
  t: TFunction,
  breadcrumbs?: SeoBreadcrumb[],
): MuseumSeo {
  const name = entry?.name ?? museum.name;
  const summary = freeSummary(museum, locale, t);
  const brand = COUNTRY.brand?.[locale]?.titleShort ?? t('app.titleShort');
  const canonicalPath = detailPath(museum.id, locale);
  const url = absoluteUrl(canonicalPath);
  const fallbackDescription =
    locale === 'en'
      ? `${name}, ${COUNTRY_NAMES[COUNTRY.code]}, with opening days, free-admission rules and directions.`
      : `${name}. ${t('museum.openingHours')}, ${t('museum.freeAccessTitle')}, ${t('museum.directions')}.`;
  const description = truncateDescription(
    `${summary} · ${museum.commune}. ${entry?.description ?? fallbackDescription}`,
    locale,
  );
  const sameAs = [
    ...(museum.website ? [museum.website] : []),
    ...(museum.wikidata ? [`https://www.wikidata.org/wiki/${museum.wikidata}`] : []),
    ...(museum.wikipedia ? [museum.wikipedia] : []),
  ];
  const openingHoursSpecification = museum.openingHours
    ? parseOpeningHours(museum.openingHours)
    : null;
  const image = museum.image ? absoluteUrl(`/${museum.image.file}`) : undefined;
  const trail = breadcrumbs ?? [
    { name: t('hub.home'), path: homePath(locale) },
    { name, path: canonicalPath },
  ];

  return {
    title: `${name}, ${museum.commune} — ${summary} | ${brand}`,
    description,
    canonicalPath,
    alternates: detailAlternates(museum.id),
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': museum.tags.includes('museum')
          ? ['Museum', 'TouristAttraction']
          : ['LandmarksOrHistoricalBuildings', 'TouristAttraction'],
        name,
        ...(!equivalentName(name, museum.name) ? { alternateName: museum.name } : {}),
        description,
        url,
        inLanguage: locale,
        ...(image ? { image } : {}),
        ...(museum.phone ? { telephone: museum.phone } : {}),
        hasMap: googleMapsPlaceUrl(museum),
        publicAccess: true,
        ...(sameAs.length > 0 ? { sameAs } : {}),
        address: {
          '@type': 'PostalAddress',
          streetAddress: museum.address,
          postalCode: museum.postalCode,
          addressLocality: museum.commune,
          addressCountry: COUNTRY.code.toUpperCase(),
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: museum.coordinates[1],
          longitude: museum.coordinates[0],
        },
        isAccessibleForFree: museum.freeAccess.some(
          (rule) => rule.kind === 'always' && !rule.audience,
        ),
        ...(openingHoursSpecification && openingHoursSpecification.length > 0
          ? { openingHoursSpecification }
          : {}),
      },
      breadcrumbJsonLd(trail),
    ],
  };
}

export function hubSeo(options: {
  kind: HubKind;
  slug?: string;
  h1: string;
  total: number;
  locale: Locale;
  t: TFunction;
  breadcrumbs: SeoBreadcrumb[];
  place?: string;
  category?: string;
}): HubSeo {
  const { kind, slug, h1, total, locale, t, breadcrumbs, place, category } = options;
  const brand = COUNTRY.brand?.[locale]?.titleShort ?? t('app.titleShort');
  const country = t(`country.${COUNTRY.code}`);
  const canonicalPath = hubPath(kind, slug, locale);
  const description =
    kind === 'index'
      ? t('hub.metaIndex', { total, country })
      : kind === 'category'
        ? t('hub.metaCategory', { total, country, category })
        : t('hub.metaPlace', { total, place });

  return {
    title: `${h1} | ${brand}`,
    description,
    canonicalPath,
    alternates: alternatesFor((candidate) => hubPath(kind, slug, candidate)),
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: h1,
        url: absoluteUrl(canonicalPath),
        inLanguage: locale,
        isPartOf: {
          '@type': 'WebSite',
          name: brand,
          url: absoluteUrl(homePath(locale)),
        },
      },
      breadcrumbJsonLd(breadcrumbs),
    ],
  };
}
