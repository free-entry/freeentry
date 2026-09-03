import { createInstance, type i18n } from 'i18next';
import type { Locale } from './i18n';
import type { EventDates, Museum, MuseumContent } from './types';
import { COUNTRY, COUNTRY_CODE } from '@/countries';

type MuseumContentMap = Record<string, MuseumContent>;

const museumModules = import.meta.glob<{ default: Museum[] }>('../../data/*/museums.json', {
  eager: true,
});
const contentModules = import.meta.glob<{ default: MuseumContentMap }>(
  '../../data/*/i18n/museums.*.json',
  { eager: true },
);
const noteModules = import.meta.glob<{ default: Record<string, string> }>(
  '../../data/*/i18n/notes.*.json',
  { eager: true },
);
const eventModules = import.meta.glob<{ default: EventDates }>('../../data/*/events.json', {
  eager: true,
});
const uiModules = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*.json', {
  eager: true,
});

export function getStaticMuseums(): Museum[] {
  return museumModules[`../../data/${COUNTRY_CODE}/museums.json`]?.default ?? [];
}

export function getStaticEvents(): EventDates {
  return eventModules[`../../data/${COUNTRY_CODE}/events.json`]?.default ?? ({} as EventDates);
}

/** One venue's localized content with the SPA's English fallback semantics. */
export function getStaticMuseumContent(id: string, locale: Locale): MuseumContentMap {
  const primary =
    contentModules[`../../data/${COUNTRY_CODE}/i18n/museums.${locale}.json`]?.default ?? {};
  const useEnglishFallback = locale !== 'en' && locale !== COUNTRY.canonicalLocale;
  const fallback = useEnglishFallback
    ? (contentModules[`../../data/${COUNTRY_CODE}/i18n/museums.en.json`]?.default ?? {})
    : {};
  const entry = { ...fallback[id], ...primary[id] };
  return Object.keys(entry).length > 0 ? { [id]: entry } : {};
}

export function getStaticNotes(locale: Locale): Record<string, string> {
  return noteModules[`../../data/${COUNTRY_CODE}/i18n/notes.${locale}.json`]?.default ?? {};
}

/** Synchronous build-time translator: resources are bundled, never fetched. */
export function createStaticI18n(locale: Locale): i18n {
  const resource = uiModules[`../locales/${locale}.json`]?.default;
  if (!resource) throw new Error(`Missing UI translations for ${locale}`);
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: 'fr',
    initImmediate: false,
    resources: { [locale]: { translation: resource } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}
