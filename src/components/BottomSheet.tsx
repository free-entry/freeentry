import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './BottomSheet.module.css';

export type Detent = 'peek' | 'half' | 'full';

interface BottomSheetProps {
  children: ReactNode;
  /** Content always visible in the grab-bar row, even at peek. */
  peekContent?: ReactNode;
  initialDetent?: Detent;
  label: string;
}

const DETENT_HEIGHTS: Record<Detent, string> = {
  peek: '3.6rem',
  half: '46vh',
  full: '88vh',
};

const ORDER: Detent[] = ['peek', 'half', 'full'];

/** Draggable three-detent sheet used for the mobile list and detail views. */
export default function BottomSheet({
  children,
  peekContent,
  initialDetent = 'half',
  label,
}: BottomSheetProps) {
  const { t } = useTranslation();
  const [detent, setDetent] = useState<Detent>(initialDetent);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  const cycle = useCallback(() => {
    setDetent((prev) => ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length]);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDetent('peek');
    }
    const node = sheetRef.current;
    node?.addEventListener('keydown', onKey);
    return () => node?.removeEventListener('keydown', onKey);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    drag.current = { startY: e.clientY, startHeight: sheet.getBoundingClientRect().height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const sheet = sheetRef.current;
    if (!drag.current || !sheet) return;
    const height = drag.current.startHeight + (drag.current.startY - e.clientY);
    sheet.style.height = `${Math.max(56, Math.min(window.innerHeight * 0.9, height))}px`;
  }

  function onPointerUp() {
    const sheet = sheetRef.current;
    if (!drag.current || !sheet) return;
    const height = sheet.getBoundingClientRect().height;
    drag.current = null;
    sheet.style.height = '';
    const vh = window.innerHeight;
    setDetent(height < vh * 0.28 ? 'peek' : height < vh * 0.65 ? 'half' : 'full');
  }

  return (
    <section
      ref={sheetRef}
      className={styles.sheet}
      style={{ height: DETENT_HEIGHTS[detent] }}
      aria-label={label}
    >
      <div
        className={styles.grabRow}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <button
          type="button"
          className={styles.handle}
          aria-expanded={detent !== 'peek'}
          aria-label={detent === 'peek' ? t('a11y.sheetExpand') : t('a11y.sheetCollapse')}
          onClick={cycle}
        >
          <span className={styles.handleBar} aria-hidden="true" />
        </button>
        {peekContent && <div className={styles.peekContent}>{peekContent}</div>}
      </div>
      <div className={styles.content} hidden={detent === 'peek'}>
        {children}
      </div>
    </section>
  );
}
