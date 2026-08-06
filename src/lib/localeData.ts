import { useEffect, useState } from 'react';
import type { MuseumContent } from './types';
import { COUNTRY_CODE } from '@/countries';
import { normalizeLocale } from './i18n';

export type MuseumContentMap = Record<string, MuseumContent>;

// Per-locale museum names/descriptions, code-split by Vite. Files that don't
// exist yet simply aren't in the glob, so lookups degrade gracefully.
const contentFiles = import.meta.glob<{ default: MuseumContentMap }>(
  '../../data/*/i18n/museums.*.json',
);

// Catalog translating the English data notes (Museum.note, FreeRule.note),
// keyed by the exact English string. English needs no file.
const noteFiles = import.meta.glob<{ default: Record<string, string> }>(
  '../../data/*/i18n/notes.*.json',
);

const cache = new Map<string, MuseumContentMap>();

/**
 * Whether a locale's content should be backfilled from museums.en.json.
 * English is the canonical description set and French is its complete
 * counterpart — and museum names in data/museums.json are already French, so
 * neither locale may inherit the English name overrides.
 */
export function needsEnglishFallback(normalized: string): boolean {
  return normalized !== 'en' && normalized !== 'fr';
}

export async function loadMuseumContent(locale: string): Promise<MuseumContentMap> {
  const normalized = normalizeLocale(locale);
  const cached = cache.get(normalized);
  if (cached) return cached;
  const loader = contentFiles[`../../data/${COUNTRY_CODE}/i18n/museums.${normalized}.json`];
  const content = loader ? (await loader()).default : {};
  cache.set(normalized, content);
  return content;
}

const noteCache = new Map<string, Record<string, string>>();

/** English-note → localized-note map for the active locale ({} for English). */
export function useNoteTranslations(locale: string): Record<string, string> {
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const normalized = normalizeLocale(locale);
    const cached = noteCache.get(normalized);
    if (cached) {
      setNotes(cached);
      return;
    }
    const loader = noteFiles[`../../data/${COUNTRY_CODE}/i18n/notes.${normalized}.json`];
    if (!loader) {
      setNotes({});
      return;
    }
    loader().then((mod) => {
      noteCache.set(normalized, mod.default);
      if (!cancelled) setNotes(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return notes;
}

/**
 * Museum content for the active locale, with English as fallback for museums
 * missing a description. French needs no fallback — museums.fr.json is the
 * canonical description set's French counterpart, and merging English here
 * would leak English name overrides into the French UI.
 */
export function useMuseumContent(locale: string): MuseumContentMap {
  const [content, setContent] = useState<MuseumContentMap>({});

  useEffect(() => {
    let cancelled = false;
    const normalized = normalizeLocale(locale);
    Promise.all([
      loadMuseumContent(normalized),
      needsEnglishFallback(normalized) ? loadMuseumContent('en') : Promise.resolve({}),
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
