import type { APIRoute } from 'astro';
import { COUNTRY } from '@/countries';
import { LOCALES } from '@/lib/i18n';
import { renderSitemapIndex } from '@/lib/sitemap';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(renderSitemapIndex(COUNTRY.siteUrl, LOCALES), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
