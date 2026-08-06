import { useTranslation } from 'react-i18next';
import { LOCALES, LOCALE_NAMES, normalizeLocale } from '@/lib/i18n';
import styles from './LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = normalizeLocale(i18n.language);

  return (
    <select
      className={styles.select}
      aria-label={t('header.language')}
      value={current}
      onChange={(e) => {
        void i18n.changeLanguage(e.target.value);
        // Keep the shareable ?lang= param in sync without adding history entries.
        const url = new URL(window.location.href);
        url.searchParams.set('lang', e.target.value);
        window.history.replaceState(null, '', url);
      }}
    >
      {LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LOCALE_NAMES[locale]}
        </option>
      ))}
    </select>
  );
}
