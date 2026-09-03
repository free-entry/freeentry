import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { localizedPathname, LOCALES, LOCALE_NAMES, normalizeLocale, type Locale } from '@/lib/i18n';
import styles from './LanguageSwitcher.module.css';

/**
 * Globe icon button revealing the language list. Opens on hover, on keyboard
 * focus and on click; hover-open closes on leave while click/focus-open stays
 * until Escape, an outside click, or focus moving elsewhere.
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const current = normalizeLocale(i18n.language);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const open = hovered || pinned;

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setPinned(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  function select(locale: Locale) {
    setPinned(false);
    setHovered(false);
    // Switch the language first so the route effect sees it settled, then move
    // to the same page under the new prefix. Filters and the map position are
    // written with replaceState, which the router never observes — read the
    // live location rather than useLocation() for search and hash.
    void i18n.changeLanguage(locale).then(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete('lang');
      navigate(
        {
          pathname: localizedPathname(location.pathname, locale),
          search: params.toString() ? `?${params.toString()}` : '',
          hash: window.location.hash,
        },
        { replace: true },
      );
    });
  }

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onBlur={(e) => {
        if (!wrapperRef.current?.contains(e.relatedTarget as Node)) setPinned(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={t('header.language')}
        title={t('header.language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => {
          // Keyboard focus opens the menu; mouse clicks are handled by
          // onClick alone (a mouse-press focus is not :focus-visible).
          if (triggerRef.current?.matches(':focus-visible')) setPinned(true);
        }}
      >
        <svg viewBox="0 0 512 512" aria-hidden="true" className={styles.icon}>
          <path
            fill="currentColor"
            d="M478.33,433.6l-90-218a22,22,0,0,0-40.67,0l-90,218a22,22,0,1,0,40.67,16.79L316.66,406H419.33l18.33,44.39A22,22,0,0,0,458,464a22,22,0,0,0,20.32-30.4ZM334.83,362,368,281.65,401.17,362Z"
          />
          <path
            fill="currentColor"
            d="M267.84,342.92a22,22,0,0,0-4.89-30.7c-.2-.15-15-11.13-36.49-34.73,39.65-53.68,62.11-114.75,71.27-143.49H330a22,22,0,0,0,0-44H214V70a22,22,0,0,0-44,0V90H54a22,22,0,0,0,0,44H251.25c-9.52,26.95-27.05,69.5-53.79,108.36-31.41-41.68-43.08-68.65-43.17-68.87a22,22,0,0,0-40.58,17c.58,1.38,14.55,34.23,52.86,83.93.92,1.19,1.83,2.35,2.74,3.51-39.24,44.35-77.74,71.86-93.85,80.74a22,22,0,1,0,21.07,38.63c2.16-1.18,48.6-26.89,101.63-85.59,22.52,24.08,38,35.44,38.93,36.1a22,22,0,0,0,30.75-4.9Z"
          />
        </svg>
      </button>
      {open && (
        <ul className={styles.menu} role="listbox" aria-label={t('header.language')}>
          {LOCALES.map((locale) => (
            <li key={locale}>
              <button
                type="button"
                role="option"
                aria-selected={locale === current}
                className={locale === current ? `${styles.item} ${styles.active}` : styles.item}
                onClick={() => select(locale)}
              >
                {LOCALE_NAMES[locale]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
