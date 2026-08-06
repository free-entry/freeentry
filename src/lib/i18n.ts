import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// French first: it is the site's home language and leads the switcher list.
export const LOCALES = [
  'fr',
  'en',
  'es',
  'it',
  'de',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'ar',
] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  de: 'Deutsch',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
};

const RTL_LOCALES: Locale[] = ['ar'];

// UI string bundles, code-split per locale by Vite.
const bundles = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*.json');

/**
 * Maps languages (zh-CN, zh-TW, pt…) onto the supported locale set. French is
 * the site's default: anything unsupported lands on 'fr'.
 */
export function normalizeLocale(lng: string): Locale {
  const lower = lng.toLowerCase();
  if (lower.startsWith('zh')) {
    return lower.includes('tw') || lower.includes('hk') || lower.includes('hant')
      ? 'zh-Hant'
      : 'zh-Hans';
  }
  const base = lower.split('-')[0];
  const hit = LOCALES.find((l) => l.toLowerCase() === lower || l.toLowerCase() === base);
  return hit ?? 'fr';
}

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(normalizeLocale(locale));
}

function applyDocumentLanguage(locale: string): void {
  const normalized = normalizeLocale(locale);
  document.documentElement.lang = normalized;
  document.documentElement.dir = isRtl(normalized) ? 'rtl' : 'ltr';
}

export async function initI18n(): Promise<void> {
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .use({
      type: 'backend' as const,
      read(language: string, _namespace: string, callback: (err: unknown, data?: unknown) => void) {
        const key = `../locales/${language}.json`;
        const loader = bundles[key];
        if (!loader) {
          callback(new Error(`No bundle for ${language}`));
          return;
        }
        loader().then(
          (mod) => callback(null, mod.default),
          (err) => callback(err),
        );
      },
    })
    .init({
      supportedLngs: [...LOCALES],
      fallbackLng: 'fr',
      load: 'currentOnly',
      interpolation: { escapeValue: false },
      detection: {
        // First visit without ?lang: follow the browser language; unsupported
        // languages land on French (the fallback everywhere in this module).
        order: ['querystring', 'localStorage', 'navigator'],
        lookupQuerystring: 'lang',
        lookupLocalStorage: 'lang',
        caches: ['localStorage'],
        convertDetectedLanguage: normalizeLocale,
      },
      returnNull: false,
    });

  applyDocumentLanguage(i18n.language);
  i18n.on('languageChanged', applyDocumentLanguage);
}

export default i18n;
