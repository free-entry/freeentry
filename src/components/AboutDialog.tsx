import { useTranslation } from 'react-i18next';
import Dialog from './Dialog';
import styles from './AboutDialog.module.css';

interface AboutDialogProps {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog label={t('app.title')} onClose={onClose} variant="center">
      <div className={styles.body}>
        <header className={styles.header}>
          <h2 className={styles.title}>{t('app.title')}</h2>
          <button
            type="button"
            className={styles.close}
            aria-label={t('a11y.dialogClose')}
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <p className={styles.tagline}>{t('app.tagline')}</p>
        <h3 className={styles.sectionTitle}>{t('about.dataSources')}</h3>
        <p className={styles.text}>{t('about.dataSourcesBody')}</p>
        <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
        <p className={styles.author}>
          {t('about.author')}{' '}
          <a href="https://github.com/tomchen" target="_blank" rel="noopener noreferrer">
            Tom Chen
          </a>
        </p>
        <p className={styles.links}>
          <a
            href="https://github.com/travel-eu/free-museums-france"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('about.github')}
          </a>
          {' · '}
          <a
            href="https://github.com/travel-eu/free-museums-france/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('about.license')}
          </a>
        </p>
      </div>
    </Dialog>
  );
}
