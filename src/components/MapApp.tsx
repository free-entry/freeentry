import { StrictMode, useEffect, useState } from 'react';
import App from '@/App';
import i18n, { initI18n, type Locale } from '@/lib/i18n';

/** Browser-only entry point for the existing interactive map application. */
export default function MapApp({ initialLocale }: { initialLocale?: Locale }) {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) {
      if (initialLocale && i18n.language !== initialLocale) {
        void i18n.changeLanguage(initialLocale).then(() => setReady(true));
      } else {
        setReady(true);
      }
      return;
    }
    void initI18n(initialLocale).then(() => setReady(true));
  }, [initialLocale]);

  if (!ready) return null;
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}
