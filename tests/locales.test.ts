import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import en from '../src/locales/en.json';
import { normalizeLocale } from '../src/lib/i18n';
import { needsEnglishFallback } from '../src/lib/localeData';

const LOCALES = ['en', 'fr', 'es', 'it', 'de', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'ar'];
const LOCALES_DIR = join(__dirname, '../src/locales');
const DATA_DIR = join(__dirname, '../data');
const countryCodes = readdirSync(DATA_DIR).filter((d) =>
  existsSync(join(DATA_DIR, d, 'museums.json')),
);
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

type Tree = { [k: string]: Tree | string };

/** Deep keys with plural suffixes collapsed ("a.b_one" → "a.b"). */
function baseKeys(tree: Tree, prefix = ''): Set<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key.replace(PLURAL_SUFFIX, '')}`;
    if (typeof value === 'string') keys.add(path);
    else for (const k of baseKeys(value, `${path}.`)) keys.add(k);
  }
  return keys;
}

function interpolations(s: string): string[] {
  return [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

function flat(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out[`${prefix}${key}`] = value;
    else Object.assign(out, flat(value, `${prefix}${key}.`));
  }
  return out;
}


const enBase = baseKeys(en as Tree);
const enFlat = flat(en as Tree);

describe.each(LOCALES)('UI locale %s', (locale) => {
  const path = join(LOCALES_DIR, `${locale}.json`);

  it('exists and covers the exact key set of en.json', () => {
    expect(existsSync(path), path).toBe(true);
    const tree = JSON.parse(readFileSync(path, 'utf-8')) as Tree;
    const keys = baseKeys(tree);
    const missing = [...enBase].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !enBase.has(k));
    expect(missing, `missing keys in ${locale}`).toEqual([]);
    expect(extra, `extra keys in ${locale}`).toEqual([]);
  });

  it('has no empty strings and preserves interpolation tokens', () => {
    const tree = JSON.parse(readFileSync(path, 'utf-8')) as Tree;
    const flattened = flat(tree);
    for (const [key, value] of Object.entries(flattened)) {
      expect(value.trim(), `${locale}:${key}`).not.toBe('');
      const enValue = enFlat[key] ?? enFlat[key.replace(PLURAL_SUFFIX, '_other')];
      if (enValue) {
        const enTokens = interpolations(enValue);
        if (enTokens.length > 0) {
          expect(interpolations(value), `${locale}:${key}`).toEqual(enTokens);
        }
      }
    }
  });
});

describe.each(countryCodes)('country %s', (cc) => {
  const CONTENT_DIR = join(DATA_DIR, cc, 'i18n');
  const museumIds = (
    JSON.parse(readFileSync(join(DATA_DIR, cc, 'museums.json'), 'utf-8')) as { id: string }[]
  ).map((m) => m.id);
  const museumsJson = JSON.parse(
    readFileSync(join(DATA_DIR, cc, 'museums.json'), 'utf-8'),
  ) as { note?: string; freeAccess: { note?: string }[] }[];

describe.each(LOCALES)('museum content %s', (locale) => {
  const path = join(CONTENT_DIR, `museums.${locale}.json`);

  it('exists, covers every museum id and has no empty descriptions', () => {
    expect(existsSync(path), path).toBe(true);
    const content = JSON.parse(readFileSync(path, 'utf-8')) as Record<
      string,
      { name?: string; description?: string }
    >;
    const ids = Object.keys(content);
    const unknown = ids.filter((id) => !museumIds.includes(id));
    expect(unknown, `unknown ids in ${locale}`).toEqual([]);
    const missing = museumIds.filter((id) => !content[id]?.description?.trim());
    expect(missing, `museums without ${locale} description`).toEqual([]);
  });

  it('provides a localized title for every museum', () => {
    // French titles are the canonical names in museums.json, not overrides.
    if (locale === 'fr') return;
    const content = JSON.parse(readFileSync(path, 'utf-8')) as Record<
      string,
      { name?: string }
    >;
    const missing = museumIds.filter((id) => !content[id]?.name?.trim());
    expect(missing, `museums without ${locale} title`).toEqual([]);
  });
});

describe.each(LOCALES.filter((l) => l !== 'en'))('note catalog %s', (locale) => {
  it('translates every English data note, with no stale entries', () => {
    const path = join(CONTENT_DIR, `notes.${locale}.json`);
    expect(existsSync(path), path).toBe(true);
    const catalog = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, string>;
    const englishNotes = new Set<string>();
    for (const m of museumsJson) {
      if (m.note) englishNotes.add(m.note);
      for (const rule of m.freeAccess) if (rule.note) englishNotes.add(rule.note);
    }
    const missing = [...englishNotes].filter((n) => !catalog[n]?.trim());
    const stale = Object.keys(catalog).filter((k) => !englishNotes.has(k));
    expect(missing, `notes missing a ${locale} translation`).toEqual([]);
    expect(stale, `stale ${locale} catalog entries`).toEqual([]);
  });
});
});

it('locales directory contains no unexpected files', () => {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
  expect(files.sort()).toEqual(LOCALES.map((l) => `${l}.json`).sort());
});

describe('French locale shows canonical French names', () => {
  it('museums.fr.json defines no name overrides — names in museums.json are already French', () => {
    const content = JSON.parse(
      readFileSync(join(DATA_DIR, 'fr/i18n', 'museums.fr.json'), 'utf-8'),
    ) as Record<string, { name?: string }>;
    const overridden = Object.entries(content)
      .filter(([, entry]) => entry.name !== undefined)
      .map(([id]) => id);
    expect(overridden, 'unexpected French name overrides').toEqual([]);
  });

  it('French never inherits English name overrides through the fallback merge', () => {
    expect(needsEnglishFallback('fr')).toBe(false);
    expect(needsEnglishFallback('en')).toBe(false);
    for (const locale of LOCALES.filter((l) => l !== 'en' && l !== 'fr')) {
      expect(needsEnglishFallback(locale), locale).toBe(true);
    }
  });
});

describe('default locale', () => {
  it('falls back to French for unsupported languages', () => {
    expect(normalizeLocale('pt')).toBe('fr');
    expect(normalizeLocale('ru-RU')).toBe('fr');
  });

  it('still maps supported languages onto their locale', () => {
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBe('fr');
    expect(normalizeLocale('zh-TW')).toBe('zh-Hant');
    expect(normalizeLocale('zh')).toBe('zh-Hans');
    expect(normalizeLocale('ar')).toBe('ar');
  });
});
