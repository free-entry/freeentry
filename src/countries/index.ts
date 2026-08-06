import type { CountryConfig } from './types';
import { fr } from './fr';

export type { CountryConfig } from './types';

export const COUNTRIES: Record<string, CountryConfig> = { fr };

/** The country this build serves; VITE_COUNTRY selects it (default fr). */
export const COUNTRY_CODE: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COUNTRY) || 'fr';

export const COUNTRY: CountryConfig = COUNTRIES[COUNTRY_CODE] ?? fr;
