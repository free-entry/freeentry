import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './OfflineBanner.module.css';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <p className={styles.banner} role="status">
      {t('app.offlineBanner')}
    </p>
  );
}
