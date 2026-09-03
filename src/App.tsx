import { useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { AppStateProvider } from './state/AppState';
import Layout from './components/Layout';
import NotFound from './components/NotFound';
import i18n, { LOCALES, type Locale } from './lib/i18n';

// BASE_URL is '/free-museums-france/' in every mode (see vite.config.ts).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

function LocaleRoute() {
  const { locale: localeParam } = useParams();
  const locale = LOCALES.includes(localeParam as Locale) ? (localeParam as Locale) : null;

  useEffect(() => {
    if (locale && i18n.language !== locale) void i18n.changeLanguage(locale);
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
          <Route path="/" element={<Layout />} />
          <Route path="/museum/:id" element={<Layout />} />
          <Route path="/:locale" element={<LocaleRoute />} />
          <Route path="/:locale/museum/:id" element={<LocaleRoute />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
