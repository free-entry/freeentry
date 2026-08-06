import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';

/**
 * Keeps the document <title> and meta description in the active locale
 * (and, on a museum page, leads the title with the museum's localized name).
 * The prerendered English head only serves crawlers; this takes over at runtime.
 */
export default function DocumentMeta() {
  const { t, i18n } = useTranslation();
  const { selected, localizedNames } = useAppState();

  useEffect(() => {
    const siteTitle = t('app.title');
    document.title = selected
      ? `${localizedNames[selected.id] ?? selected.name} — ${siteTitle}`
      : siteTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('app.metaDescription'));
  }, [t, i18n.language, selected, localizedNames]);

  return null;
}
