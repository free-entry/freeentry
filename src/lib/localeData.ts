import { useEffect, useState } from 'react';
import type { MuseumContent } from './types';
import { normalizeLocale } from './i18n';

export type MuseumContentMap = Record<string, MuseumContent>;

// Per-locale museum names/descriptions, code-split by Vite. Files that don't
// exist yet simply aren't in the glob, so lookups degrade gracefully.
const contentFiles = import.meta.glob<{ default: MuseumContentMap }>(
  '../../data/i18n/museums.*.json',
);

const cache = new Map<string, MuseumContentMap>();

export async function loadMuseumContent(locale: string): Promise<MuseumContentMap> {
  const normalized = normalizeLocale(locale);
  const cached = cache.get(normalized);
  if (cached) return cached;
  const loader = contentFiles[`../../data/i18n/museums.${normalized}.json`];
  const content = loader ? (await loader()).default : {};
  cache.set(normalized, content);
  return content;
}

/**
 * Museum content for the active locale, with English as fallback for museums
 * missing a description. French needs no fallback — museums.fr.json is the
 * canonical description set's French counterpart.
 */
export function useMuseumContent(locale: string): MuseumContentMap {
  const [content, setContent] = useState<MuseumContentMap>({});

  useEffect(() => {
    let cancelled = false;
    const normalized = normalizeLocale(locale);
    Promise.all([
      loadMuseumContent(normalized),
      normalized === 'en' ? Promise.resolve({}) : loadMuseumContent('en'),
    ]).then(([primary, fallback]) => {
      if (cancelled) return;
      const merged: MuseumContentMap = { ...fallback };
      for (const [id, entry] of Object.entries(primary)) {
        merged[id] = { ...merged[id], ...entry };
      }
      setContent(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return content;
}
