import { StrictMode, useEffect, useState } from 'react';
import App from '@/App';
import i18n, {
  initI18n,
  localeFromPathname,
  localizedPathname,
  normalizeLocale,
  type Locale,
} from '@/lib/i18n';

const BASE = import.meta.env.BASE_URL;

/** Basename-relative app path, e.g. '/fr/museum/<id>/'. */
function appPathname(): string {
  const path = window.location.pathname;
  const stripped = path.startsWith(BASE) ? path.slice(BASE.length - 1) : path;
  return stripped || '/';
}

/**
 * Unprefixed paths are English, with one exception: the bare home ("/", no
 * ?museum=) is the auto-detect entry (PWA start URL, typed domain, old
 * ?lang= links). "/?museum=<id>" comes from an English static page and
 * "/museum/<id>/" is the English shell, so both stay English.
 */
function explicitLocale(initialLocale?: Locale): Locale | undefined {
  if (initialLocale) return initialLocale;
  const path = appPathname();
  const fromPath = localeFromPathname(path);
  if (fromPath) return fromPath;
  const params = new URLSearchParams(window.location.search);
  if (params.has('lang')) return undefined;
  return path !== '/' || params.has('museum') ? 'en' : undefined;
}

/**
 * Auto-detect entry: when the detector settles on anything but English, move
 * to that locale's path before the router mounts, so the URL and the UI
 * language always agree.
 */
function redirectToDetectedLocale(): void {
  const detected = normalizeLocale(i18n.language);
  if (detected === 'en') return;
  const url = new URL(window.location.href);
  url.pathname = `${BASE.replace(/\/$/, '')}${localizedPathname(appPathname(), detected)}`;
  url.searchParams.delete('lang');
  window.history.replaceState(window.history.state, '', url);
}

/** Browser-only entry point for the existing interactive map application. */
export default function MapApp({ initialLocale }: { initialLocale?: Locale }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // A locale prefix in the URL is authoritative (also when the service
    // worker serves the root shell for a localized URL); otherwise detect.
    const explicit = explicitLocale(initialLocale);
    const boot = i18n.isInitialized
      ? explicit && normalizeLocale(i18n.language) !== explicit
        ? i18n.changeLanguage(explicit).then(() => undefined)
        : Promise.resolve()
      : initI18n(explicit);
    void boot.then(() => {
      if (!explicit) redirectToDetectedLocale();
      setReady(true);
    });
  }, [initialLocale]);

  if (!ready) return null;
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}
