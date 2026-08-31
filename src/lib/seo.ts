import type { TFunction } from 'i18next';
import { COUNTRY } from '@/countries';
import { LOCALES, type Locale } from './i18n';
import type { Museum, MuseumContent } from './types';

export interface HreflangLink {
  hreflang: string;
  href: string;
}

export interface MuseumSeo {
  title: string;
  description: string;
  canonicalPath: string;
  alternates: HreflangLink[];
  jsonLd: Record<string, unknown>;
}

const COUNTRY_NAMES: Record<string, string> = {
  fr: 'France',
  it: 'Italy',
  be: 'Belgium',
};

export function detailPath(id: string, locale: Locale): string {
  return locale === 'en' ? `/museum/${id}` : `/${locale}/museum/${id}`;
}

export function detailAlternates(id: string): HreflangLink[] {
  const links: HreflangLink[] = LOCALES.map((locale) => ({
    hreflang: locale,
    href: `${COUNTRY.siteUrl}${detailPath(id, locale)}`,
  }));
  links.push({ hreflang: 'x-default', href: `${COUNTRY.siteUrl}${detailPath(id, 'en')}` });
  return links;
}

export function homeAlternates(): HreflangLink[] {
  const href = `${COUNTRY.siteUrl}/`;
  return [
    ...LOCALES.map((locale) => ({ hreflang: locale, href })),
    { hreflang: 'x-default', href },
  ];
}

function freeSummary(museum: Museum, locale: Locale, t: TFunction): string {
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

export function museumSeo(
  museum: Museum,
  entry: MuseumContent | undefined,
  locale: Locale,
  t: TFunction,
): MuseumSeo {
  const name = entry?.name ?? museum.name;
  const summary = freeSummary(museum, locale, t);
  const brand = COUNTRY.brand?.[locale]?.titleShort ?? t('app.titleShort');
  const canonicalPath = detailPath(museum.id, locale);
  const url = `${COUNTRY.siteUrl}${canonicalPath}`;
  const description = entry?.description
    ? `${summary}. ${entry.description}`
    : locale === 'en'
      ? `${summary}. ${name}, ${museum.commune}, ${COUNTRY_NAMES[COUNTRY.code]} — opening days, free-admission rules and directions.`
      : `${summary}. ${name}, ${museum.commune}. ${t('museum.openingHours')}, ${t('museum.freeAccessTitle')}, ${t('museum.directions')}.`;
  const sameAs = [
    ...(museum.website ? [museum.website] : []),
    ...(museum.wikidata ? [`https://www.wikidata.org/wiki/${museum.wikidata}`] : []),
    ...(museum.wikipedia ? [museum.wikipedia] : []),
  ];

  return {
    title: `${name} — ${summary} | ${brand}`,
    description,
    canonicalPath,
    alternates: detailAlternates(museum.id),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Museum',
      name,
      ...(name !== museum.name ? { alternateName: museum.name } : {}),
      url,
      inLanguage: locale,
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
    },
  };
}
