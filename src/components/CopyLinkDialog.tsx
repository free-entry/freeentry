import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from './Dialog';
import styles from './CopyLinkDialog.module.css';

interface CopyLinkDialogProps {
  onClose: () => void;
  /** Confirmation text; defaults to the "link copied" message. */
  message?: string;
}

/** Brief copy confirmation — auto-dismisses, but Esc/backdrop/click still close it early. */
export default function CopyLinkDialog({ onClose, message }: CopyLinkDialogProps) {
  const { t } = useTranslation();
  const text = message ?? t('museum.linkCopied');

  useEffect(() => {
    const timer = window.setTimeout(onClose, 1800);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <Dialog label={text} onClose={onClose} variant="center">
      <div className={styles.body}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={styles.icon}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <p className={styles.text}>{text}</p>
      </div>
    </Dialog>
  );
}
