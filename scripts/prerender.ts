/**
 * Post-build prerender: emits dist/museum/<id>/index.html with per-museum
 * <title>, meta description, OpenGraph, canonical, hreflang alternates and
 * schema.org/Museum JSON-LD, plus sitemap.xml and a 404.html SPA fallback.
 * Light-touch SEO for a static host — no SSR involved.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Museum, MuseumContent } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://travel-eu.github.io/free-museums-paris';
const LOCALES = ['en', 'fr', 'es', 'it', 'de', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'ar'];

const museums: Museum[] = JSON.parse(readFileSync(join(ROOT, 'data/museums.json'), 'utf-8'));
const contentPath = join(ROOT, 'data/i18n/museums.en.json');
const content: Record<string, MuseumContent> = existsSync(contentPath)
  ? JSON.parse(readFileSync(contentPath, 'utf-8'))
  : {};

const shell = readFileSync(join(DIST, 'index.html'), 'utf-8');

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function freeSummary(museum: Museum): string {
  const kinds = new Set(museum.freeAccess.map((r) => r.kind));
  if (museum.freeAccess.some((r) => r.kind === 'always' && !r.audience)) return 'Free admission';
  if (kinds.has('nth-weekday')) return 'Free on selected days each month';
  if (kinds.has('event') || kinds.has('annual-date')) return 'Free on special days';
  return 'Museum in Île-de-France';
}

function alternates(path: string): string {
  const links = LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${path}?lang=${l}" />`,
  );
  links.push(`<link rel="alternate" hreflang="x-default" href="${SITE}${path}" />`);
  return links.join('\n    ');
}

function museumHead(museum: Museum): string {
  const description = content[museum.id]?.description
    ? `${freeSummary(museum)}. ${content[museum.id].description}`
    : `${freeSummary(museum)}. ${museum.name}, ${museum.commune}, Île-de-France — opening days, free-admission rules and directions.`;
  const url = `${SITE}/museum/${museum.id}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Museum',
    name: museum.name,
    ...(content[museum.id]?.name ? { alternateName: content[museum.id].name } : {}),
    url,
    ...(museum.website ? { sameAs: museum.website } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: museum.address,
      postalCode: museum.postalCode,
      addressLocality: museum.commune,
      addressCountry: 'FR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: museum.coordinates[1],
      longitude: museum.coordinates[0],
    },
    isAccessibleForFree: museum.freeAccess.some((r) => r.kind === 'always' && !r.audience),
  };
  const title = `${museum.name} — ${freeSummary(museum)} | Free Museums Paris`;
  return `<title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    ${alternates(`/museum/${museum.id}`)}
    <meta property="og:type" content="place" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

// Replace the shell's <title> + description with per-museum head content.
const TITLE_RE = /<title>.*?<\/title>/s;
const DESC_RE = /<meta name="description"[^>]*\/>/;

let count = 0;
for (const museum of museums) {
  const dir = join(DIST, 'museum', museum.id);
  mkdirSync(dir, { recursive: true });
  const html = shell.replace(DESC_RE, '').replace(TITLE_RE, museumHead(museum));
  writeFileSync(join(dir, 'index.html'), html);
  count++;
}

// Home page: canonical + hreflang + WebSite JSON-LD.
const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Free Museums Paris & Île-de-France',
  url: `${SITE}/`,
  inLanguage: LOCALES,
};
const homeHead = `<link rel="canonical" href="${SITE}/" />
    ${alternates('/')}
    <script type="application/ld+json">${JSON.stringify(homeJsonLd)}</script>
    </head>`;
writeFileSync(join(DIST, 'index.html'), shell.replace('</head>', homeHead));

// SPA fallback for unknown paths under the project subdirectory.
copyFileSync(join(DIST, 'index.html'), join(DIST, '404.html'));

// Sitemap.
const urls = [`${SITE}/`, ...museums.map((m) => `${SITE}/museum/${m.id}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);

console.log(`Prerendered ${count} museum pages, sitemap with ${urls.length} URLs.`);
