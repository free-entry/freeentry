import type { APIRoute } from 'astro';
import { COUNTRY } from '@/countries';

export const prerender = true;

// Crawlers only consult the domain root's robots.txt; the authoritative copy
// lives in the travel-eu.github.io repo and lists every country's sitemap.
// This per-deployment file keeps the sitemap pointer correct for mirrors.
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${COUNTRY.siteUrl}/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
