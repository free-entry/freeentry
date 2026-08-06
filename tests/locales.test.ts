import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import museumsJson from '../data/museums.json';
import en from '../src/locales/en.json';

const LOCALES = ['en', 'fr', 'es', 'it', 'de', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'ar'];
const LOCALES_DIR = join(__dirname, '../src/locales');
const CONTENT_DIR = join(__dirname, '../data/i18n');
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

const museumIds = (museumsJson as { id: string }[]).map((m) => m.id);
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

describe.each(LOCALES)('museum content %s', (locale) => {
  const path = join(CONTENT_DIR, `museums.${locale}.json`);

  it('exists, covers every museum id and has no empty descriptions', () => {
    if (locale === 'fr') {
      // French names are canonical; the fr file still carries descriptions.
      expect(existsSync(path), path).toBe(true);
    }
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
});

it('locales directory contains no unexpected files', () => {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
  expect(files.sort()).toEqual(LOCALES.map((l) => `${l}.json`).sort());
});
