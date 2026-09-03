import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRIES, type CountryConfig } from '@/countries';
import { buildHubIndex, nearbyMuseums, slugify } from '@/lib/hubs';
import type { Museum } from '@/lib/types';

const source = { url: 'https://example.com', checkedAt: '2026-08-01' };

function venue(
  id: string,
  commune: string,
  department: string,
  coordinates: [number, number],
): Museum {
  return {
    id,
    name: id,
    coordinates,
    address: '1 Test Street',
    postalCode: '00000',
    commune,
    department,
    tags: ['museum'],
    freeAccess: [{ kind: 'always', source }],
  };
}

const country: CountryConfig = {
  code: 'xx',
  canonicalLocale: 'en',
  basePath: '/test/',
  siteUrl: 'https://example.com/test',
  repoUrl: 'https://example.com/repo',
  bbox: { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 },
  adminAreas: {
    names: { A: 'Àrea One', B: 'Area Two', C: 'Area Three' },
    postalPrefix: () => /.*/,
    districtRanges: {},
  },
  eventKeys: [],
};

describe('slugify', () => {
  it('strips diacritics and collapses punctuation', () => {
    expect(slugify("Île-d'Orléans / Centre")).toBe('ile-d-orleans-centre');
  });
});

describe('buildHubIndex', () => {
  it('builds eligible areas, cities and categories with collision-safe city slugs', () => {
    const museums = [
      venue('paris-1', 'Paris', 'A', [0, 0]),
      venue('paris-2', 'Paris', 'A', [0.1, 0]),
      venue('saint-paul-a1', 'Saint-Paul', 'B', [1, 0]),
      venue('saint-paul-a2', 'Saint-Paul', 'B', [1.1, 0]),
      venue('other-b', 'Elsewhere', 'B', [1.2, 0]),
      venue('saint-paul-c1', 'Saint Paul', 'C', [2, 0]),
      venue('saint-paul-c2', 'Saint Paul', 'C', [2.1, 0]),
      venue('other-c', 'Somewhere', 'C', [2.2, 0]),
    ];
    const index = buildHubIndex(museums, country);

    expect(index.areas.map(({ slug }) => slug)).toEqual(['area-one', 'area-two', 'area-three']);
    expect(index.cities.map(({ slug }) => slug)).toEqual(['saint-paul-b', 'saint-paul-c']);
    expect(index.cityPageExists('Paris', 'A')).toBe(false);
    expect(index.cityPageExists('Saint-Paul', 'B')).toBe(true);
    expect(index.categories).toMatchObject([{ category: 'always', count: 8 }]);
  });

  it.each(Object.keys(COUNTRIES))('generates unique hub slugs for %s', (code) => {
    const museums = JSON.parse(
      readFileSync(join(__dirname, `../data/${code}/museums.json`), 'utf8'),
    ) as Museum[];
    const index = buildHubIndex(museums, COUNTRIES[code]);
    expect(new Set(index.areas.map(({ slug }) => slug)).size).toBe(index.areas.length);
    expect(new Set(index.cities.map(({ slug }) => slug)).size).toBe(index.cities.length);
    expect(new Set(index.categories.map(({ slug }) => slug)).size).toBe(index.categories.length);
  });
});

describe('nearbyMuseums', () => {
  it('puts same-commune venues first, then sorts by distance with stable ties', () => {
    const center = venue('center', 'Center', 'A', [0, 0]);
    const farSame = venue('far-same', 'Center', 'A', [1, 0]);
    const closeOther = venue('close-other', 'Other', 'A', [0.01, 0]);
    const tiedFirst = venue('tied-first', 'Other', 'A', [0.02, 0]);
    const tiedSecond = venue('tied-second', 'Other', 'A', [-0.02, 0]);

    expect(
      nearbyMuseums(center, [center, farSame, closeOther, tiedFirst, tiedSecond]).map(({ id }) => id),
    ).toEqual(['far-same', 'close-other', 'tied-first', 'tied-second']);
  });
});
