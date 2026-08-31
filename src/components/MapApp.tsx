import { StrictMode, useEffect, useState } from 'react';
import App from '@/App';
import i18n, { initI18n } from '@/lib/i18n';

/** Browser-only entry point for the existing interactive map application. */
export default function MapApp() {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) {
      setReady(true);
      return;
    }
    void initI18n().then(() => setReady(true));
  }, []);

  if (!ready) return null;
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}
