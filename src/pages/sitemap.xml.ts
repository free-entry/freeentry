import type { APIRoute } from 'astro';
import { COUNTRY } from '@/countries';
import { LOCALES } from '@/lib/i18n';
import { getStaticMuseums } from '@/lib/staticData';
import { detailPath } from '@/lib/seo';

export const prerender = true;

export const GET: APIRoute = () => {
  const urls = [
    `${COUNTRY.siteUrl}/`,
    ...getStaticMuseums().flatMap((museum) =>
      LOCALES.map((locale) => `${COUNTRY.siteUrl}${detailPath(museum.id, locale)}`),
    ),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
