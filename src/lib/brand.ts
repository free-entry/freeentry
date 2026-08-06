import { COUNTRY } from '@/countries';
import { normalizeLocale } from './i18n';

/** Country-aware brand strings: config override first, locale files as fallback. */
export function brandString(
  locale: string,
  key: 'title' | 'titleShort' | 'metaDescription',
  fallback: string,
): string {
  const entry = COUNTRY.brand?.[normalizeLocale(locale)];
  return entry?.[key] ?? fallback;
}
