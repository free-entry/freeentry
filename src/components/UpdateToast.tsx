import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdateToast.module.css';

/** Small toast offering a reload when a new service-worker version is ready. */
export default function UpdateToast() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={styles.toast} role="status">
      <span>{t('app.updateAvailable')}</span>
      <button type="button" className={styles.reload} onClick={() => void updateServiceWorker(true)}>
        {t('app.updateReload')}
      </button>
      <button
        type="button"
        className={styles.dismiss}
        aria-label={t('a11y.dialogClose')}
        onClick={() => setNeedRefresh(false)}
      >
        ✕
      </button>
    </div>
  );
}
