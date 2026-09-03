import { useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { AppStateProvider } from './state/AppState';
import Layout from './components/Layout';
import NotFound from './components/NotFound';
import i18n, { LOCALES, normalizeLocale, type Locale } from './lib/i18n';

// BASE_URL is '/free-museums-france/' in every mode (see astro.config.mjs).
// The trailing slash is kept on purpose: react-router maps the root route to
// the bare basename, and the canonical home is '/free-museums-france/'.
const basename = import.meta.env.BASE_URL;

/**
 * The locale prefix in the path drives the UI language: '/fr/…' is French,
 * an unprefixed path is English (MapApp already redirected the auto-detect
 * entry before the router mounted). Every app route renders through this one
 * component so switching prefixes never remounts the map.
 */
function LocaleRoute() {
  const { locale: localeParam } = useParams();
  const locale: Locale | null =
    localeParam === undefined
      ? 'en'
      : LOCALES.includes(localeParam as Locale)
        ? (localeParam as Locale)
        : null;

  useEffect(() => {
    if (locale && normalizeLocale(i18n.language) !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  return locale ? <Layout /> : <NotFound />;
}

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route
          element={
            <AppStateProvider>
              <Outlet />
            </AppStateProvider>
          }
        >
          <Route path="/" element={<LocaleRoute />} />
          <Route path="/museum/:id" element={<LocaleRoute />} />
          <Route path="/:locale" element={<LocaleRoute />} />
          <Route path="/:locale/museum/:id" element={<LocaleRoute />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
