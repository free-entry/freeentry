import type { CountryConfig } from './types';
import { ARRONDISSEMENT_RANGES, DEPARTMENT_NAMES, postalPrefix } from '../lib/departments';

/** France — the original deployment. */
export const fr: CountryConfig = {
  code: 'fr',
  basePath: '/free-museums-france/',
  siteUrl: 'https://travel-eu.github.io/free-museums-france',
  repoUrl: 'https://github.com/travel-eu/free-museums-france',
  bbox: { minLat: 41.2, maxLat: 51.2, minLng: -5.3, maxLng: 9.7 },
  adminAreas: {
    names: DEPARTMENT_NAMES,
    postalPrefix,
    districtRanges: ARRONDISSEMENT_RANGES,
  },
  eventKeys: ['museum-night', 'heritage-days'],
};
