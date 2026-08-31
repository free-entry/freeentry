import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import type { Museum } from '@/lib/types';
import { haversineKm } from '@/lib/distance';
import CopyLinkDialog from './CopyLinkDialog';
import DetailContent from './DetailContent';
import { DateStatusContent } from './MuseumDateStatus';

interface DetailPanelProps {
  museum: Museum;
  onBack: () => void;
}

/** SPA behavior wrapped around the shared, pure museum-detail presentation. */
export default function DetailPanel({ museum, onBack }: DetailPanelProps) {
  const { t, i18n } = useTranslation();
  const { ctx, content, notes, filters, today } = useAppState();
  const [copied, setCopied] = useState<'link' | 'address' | null>(null);
  const locale = i18n.language;
  const fullAddress = [museum.address, `${museum.postalCode} ${museum.commune}`]
    .filter(Boolean)
    .join(', ');
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}museum/${museum.id}`;
  const distance = filters.center ? haversineKm(filters.center, museum.coordinates) : null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied('link');
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(fullAddress);
    setCopied('address');
  }

  return (
    <>
      <DetailContent
        museum={museum}
        content={content}
        notes={notes}
        locale={locale}
        t={t}
        baseUrl={import.meta.env.BASE_URL}
        today={today}
        events={ctx.events}
        distanceKm={distance}
        onBack={onBack}
        onCopyLink={() => void copyLink()}
        onCopyAddress={() => void copyAddress()}
        dateStatus={
          <DateStatusContent museum={museum} locale={locale} today={today} ctx={ctx} t={t} />
        }
      />
      {copied && (
        <CopyLinkDialog
          message={t(copied === 'address' ? 'museum.addressCopied' : 'museum.linkCopied')}
          onClose={() => setCopied(null)}
        />
      )}
    </>
  );
}
