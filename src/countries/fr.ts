import { SITE_URL } from '../lib/deployment';
import type { CountryConfig } from './types';
import { ARRONDISSEMENT_RANGES, DEPARTMENT_NAMES, postalPrefix } from '../lib/departments';

/** France — the original deployment. */
export const fr: CountryConfig = {
  code: 'fr',
  canonicalLocale: 'fr',
  basePath: '/france/',
  siteUrl: `${SITE_URL}/france`,
  repoUrl: 'https://github.com/free-entry/freeentry',
  bbox: { minLat: 41.2, maxLat: 51.2, minLng: -5.3, maxLng: 9.7 },
  adminAreas: {
    names: DEPARTMENT_NAMES,
    postalPrefix,
    districtRanges: ARRONDISSEMENT_RANGES,
  },
  eventKeys: ['museum-night', 'heritage-days'],
};
