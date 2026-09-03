import { describe, expect, it } from 'vitest';
import type { CountryConfig } from '@/countries';
import { buildHubIndex } from '@/lib/hubs';
import {
  buildSitemapEntries,
  museumLastmod,
  renderSitemap,
  renderSitemapIndex,
} from '@/lib/sitemap';
import type { Museum } from '@/lib/types';

const country: CountryConfig = {
  code: 'xx',
  canonicalLocale: 'en',
  basePath: '/test/',
  siteUrl: 'https://example.com/test',
  repoUrl: 'https://example.com/repo',
  bbox: { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 },
  adminAreas: {
    names: { A: 'Test Area' },
    postalPrefix: () => /.*/,
    districtRanges: {},
  },
  eventKeys: [],
};

const museums: Museum[] = [
  {
    id: 'one',
    name: 'One',
    coordinates: [0, 0],
    address: '1 Street',
    postalCode: '00000',
    commune: 'Town',
    department: 'A',
    tags: ['museum'],
    openingHours: 'Mo-Fr 09:00-17:00',
    openingHoursSource: { url: 'https://example.com/hours', checkedAt: '2026-08-04' },
    freeAccess: [
      {
        kind: 'always',
        source: { url: 'https://example.com/free', checkedAt: '2026-08-02' },
      },
    ],
  },
  {
    id: 'two',
    name: 'Two',
    coordinates: [0.1, 0],
    address: '2 Street',
    postalCode: '00000',
    commune: 'Town',
    department: 'A',
    tags: ['museum'],
    freeAccess: [
      {
        kind: 'always',
        source: { url: 'https://example.com/free', checkedAt: '2026-08-03' },
      },
    ],
  },
  {
    id: 'three',
    name: 'Three',
    coordinates: [0.2, 0],
    address: '3 Street',
    postalCode: '00000',
    commune: 'Village',
    department: 'A',
    tags: ['museum'],
    freeAccess: [
      {
        kind: 'always',
        source: { url: 'https://example.com/free', checkedAt: '2026-08-01' },
      },
    ],
  },
];

describe('sitemap helpers', () => {
  it('uses the newest source check as lastmod', () => {
    expect(museumLastmod(museums[0])).toBe('2026-08-04');
  });

  it('builds locale URL entries with all alternates and trailing slashes', () => {
    const hubs = buildHubIndex(museums, country);
    const entries = buildSitemapEntries(museums, hubs, country, 'fr', ['en', 'fr']);
    expect(entries).toHaveLength(8);
    expect(entries.every(({ loc }) => loc.endsWith('/'))).toBe(true);
    expect(entries.every(({ alternates }) => alternates.length === 3)).toBe(true);
    expect(entries.find(({ loc }) => loc.endsWith('/fr/museum/one/'))?.lastmod).toBe(
      '2026-08-04',
    );

    const xml = renderSitemap(entries);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('<lastmod>2026-08-04</lastmod>');
    expect(xml.match(/<xhtml:link /g)).toHaveLength(entries.length * 3);
  });

  it('renders a sitemap index with one file per locale', () => {
    const xml = renderSitemapIndex(country.siteUrl, ['en', 'fr']);
    expect(xml.match(/<sitemap>/g)).toHaveLength(2);
    expect(xml).toContain('https://example.com/test/sitemap-fr.xml');
  });
});
