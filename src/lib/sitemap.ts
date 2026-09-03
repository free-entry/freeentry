import type { CountryConfig } from '@/countries';
import type { Locale } from './i18n';
import type { HubIndex } from './hubs';
import { detailPath, homePath, hubPath } from './seo';
import type { Museum } from './types';

export interface SitemapAlternate {
  hreflang: string;
  href: string;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  alternates: SitemapAlternate[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function museumLastmod(museum: Museum): string | null {
  const dates = [
    ...museum.freeAccess.map((rule) => rule.source.checkedAt),
    museum.openingHoursSource?.checkedAt,
  ].filter((date): date is string => Boolean(date));
  return dates.length > 0 ? dates.sort().at(-1)! : null;
}

export function museumsLastmod(museums: Museum[]): string | null {
  const dates = museums
    .map(museumLastmod)
    .filter((date): date is string => date !== null)
    .sort();
  return dates.at(-1) ?? null;
}

function alternateLinks(
  siteUrl: string,
  locales: readonly Locale[],
  pathForLocale: (locale: Locale) => string,
): SitemapAlternate[] {
  return [
    ...locales.map((locale) => ({
      hreflang: locale,
      href: `${siteUrl}${pathForLocale(locale)}`,
    })),
    { hreflang: 'x-default', href: `${siteUrl}${pathForLocale('en')}` },
  ];
}

export function buildSitemapEntries(
  museums: Museum[],
  hubs: HubIndex,
  country: CountryConfig,
  locale: Locale,
  locales: readonly Locale[],
): SitemapEntry[] {
  const fallbackLastmod = museumsLastmod(museums);
  if (!fallbackLastmod) return [];

  const entry = (
    pathForLocale: (candidate: Locale) => string,
    lastmod: string | null,
  ): SitemapEntry => ({
    loc: `${country.siteUrl}${pathForLocale(locale)}`,
    lastmod: lastmod ?? fallbackLastmod,
    alternates: alternateLinks(country.siteUrl, locales, pathForLocale),
  });

  return [
    entry(homePath, fallbackLastmod),
    entry((candidate) => hubPath('index', undefined, candidate), fallbackLastmod),
    ...hubs.areas.map((area) =>
      entry((candidate) => hubPath('area', area.slug, candidate), museumsLastmod(area.museums)),
    ),
    ...hubs.cities.map((city) =>
      entry((candidate) => hubPath('city', city.slug, candidate), museumsLastmod(city.museums)),
    ),
    ...hubs.categories.map((category) =>
      entry(
        (candidate) => hubPath('category', category.slug, candidate),
        museumsLastmod(category.museums),
      ),
    ),
    ...museums.map((museum) =>
      entry((candidate) => detailPath(museum.id, candidate), museumLastmod(museum)),
    ),
  ];
}

export function renderSitemapIndex(siteUrl: string, locales: readonly Locale[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locales
  .map((locale) => `  <sitemap><loc>${escapeXml(`${siteUrl}/sitemap-${locale}.xml`)}</loc></sitemap>`)
  .join('\n')}
</sitemapindex>
`;
}

export function renderSitemap(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    ({ loc, lastmod, alternates }) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
${alternates
  .map(
    ({ hreflang, href }) =>
      `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`,
  )
  .join('\n')}
  </url>`,
  )
  .join('\n')}
</urlset>
`;
}
