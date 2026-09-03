import { describe, expect, it } from 'vitest';
import { createStaticI18n } from '@/lib/staticData';
import {
  detailPath,
  homeSeo,
  homePath,
  hubPath,
  museumSeo,
} from '@/lib/seo';
import type { Museum } from '@/lib/types';

const museum: Museum = {
  id: 'test-museum',
  name: "Musée de l'Histoire",
  coordinates: [2.35, 48.86],
  address: '1 rue du Test',
  postalCode: '75001',
  commune: 'Paris',
  department: '75',
  phone: '+33 1 23 45 67 89',
  openingHours: 'Tu-Su 10:00-18:00; PH off',
  openingHoursSource: { url: 'https://example.com/hours', checkedAt: '2026-08-01' },
  tags: ['museum'],
  image: {
    file: 'images/museums/test-museum.jpg',
    author: 'Test',
    license: 'CC0 1.0',
    sourceUrl: 'https://example.com/image',
  },
  freeAccess: [
    {
      kind: 'always',
      source: { url: 'https://example.com/free', checkedAt: '2026-08-02' },
    },
  ],
};

describe('SEO paths', () => {
  it('uses root English paths and locale-prefixed paths with trailing slashes', () => {
    expect(homePath('en')).toBe('/');
    expect(homePath('fr')).toBe('/fr/');
    expect(detailPath('louvre', 'en')).toBe('/museum/louvre/');
    expect(detailPath('louvre', 'fr')).toBe('/fr/museum/louvre/');
    expect(hubPath('index', undefined, 'en')).toBe('/museums/');
    expect(hubPath('area', 'paris', 'fr')).toBe('/fr/area/paris/');
    expect(hubPath('city', 'lyon', 'en')).toBe('/city/lyon/');
    expect(hubPath('category', 'always', 'de')).toBe('/de/free/always/');
  });

  it('builds a localized home canonical and SearchAction', () => {
    const seo = homeSeo('fr');
    expect(seo.canonicalPath).toBe('/fr/');
    expect(seo.alternates).toHaveLength(11);
    expect(seo.jsonLd).toMatchObject({
      '@type': 'WebSite',
      inLanguage: 'fr',
      potentialAction: {
        '@type': 'SearchAction',
        target:
          'https://freeentry.org/free-museums-france/fr/?q={search_term_string}',
      },
    });
  });
});

describe('museumSeo', () => {
  it('builds the new title, bounded description and structured-data nodes', () => {
    const i18n = createStaticI18n('en');
    const seo = museumSeo(
      museum,
      {
        name: 'Museum of History',
        description:
          'A deliberately long museum description that includes enough words to cross the search snippet boundary while still allowing truncation at a clean word boundary for visitors.',
      },
      'en',
      i18n.t.bind(i18n),
    );

    expect(seo.title).toBe('Museum of History, Paris — Free admission | Free Museums France');
    expect(seo.canonicalPath).toBe('/museum/test-museum/');
    expect(seo.description.length).toBeLessThanOrEqual(155);
    expect(seo.description.endsWith('…')).toBe(true);
    expect(seo.jsonLd).toHaveLength(2);
    expect(seo.jsonLd[0]).toMatchObject({
      '@type': ['Museum', 'TouristAttraction'],
      telephone: museum.phone,
      publicAccess: true,
      image: 'https://freeentry.org/free-museums-france/images/museums/test-museum.jpg',
    });
    expect(seo.jsonLd[0].openingHoursSpecification).toHaveLength(1);
    expect(seo.jsonLd[1]).toMatchObject({ '@type': 'BreadcrumbList' });
  });

  it('uses the shorter CJK description limit and drops apostrophe-only alternate names', () => {
    const i18n = createStaticI18n('zh-Hans');
    const seo = museumSeo(
      museum,
      { name: 'Musée de l’Histoire', description: '这是一段用于验证搜索摘要长度限制的博物馆介绍文字。'.repeat(6) },
      'zh-Hans',
      i18n.t.bind(i18n),
    );

    expect(seo.description.length).toBeLessThanOrEqual(78);
    expect(seo.description.endsWith('…')).toBe(true);
    expect(seo.jsonLd[0]).not.toHaveProperty('alternateName');
  });
});
