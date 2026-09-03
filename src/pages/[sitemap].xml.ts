import type { APIRoute } from 'astro';
import { COUNTRY } from '@/countries';
import { buildHubIndex } from '@/lib/hubs';
import { LOCALES, type Locale } from '@/lib/i18n';
import { buildSitemapEntries, renderSitemap } from '@/lib/sitemap';
import { getStaticMuseums } from '@/lib/staticData';

export const prerender = true;

export function getStaticPaths() {
  return LOCALES.map((locale) => ({
    params: { sitemap: `sitemap-${locale}` },
    props: { locale },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const locale = props.locale as Locale;
  const museums = getStaticMuseums();
  const hubs = buildHubIndex(museums, COUNTRY);
  const entries = buildSitemapEntries(museums, hubs, COUNTRY, locale, LOCALES);
  return new Response(renderSitemap(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
