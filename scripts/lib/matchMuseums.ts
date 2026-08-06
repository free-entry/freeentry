import type { Museum } from '../../src/lib/types';

/** Articles/fillers that carry no identity — removed before comparison. */
const STOPWORDS = new Set([
  'musee',
  'museum',
  'de',
  'du',
  'des',
  'le',
  'la',
  'les',
  'l',
  'd',
  'et',
  'a',
  'au',
  'aux',
  'en',
]);

/** Lowercase, strip accents/punctuation, drop stopwords: "Musée d'Art…" → "art …". */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ');
}

function containsWords(haystack: string, needle: string): boolean {
  // Single-word needles ("chateau", "fragonard") are too ambiguous — they
  // would swallow unrelated venues sharing one common word.
  if (needle.split(' ').length < 2) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Resolves a scraped display name to a museum record.
 * Order: alias table → exact normalized match → whole-word containment in
 * either direction. Ambiguous containment (several candidates) returns null
 * so the update script reports it instead of guessing.
 */
export function matchMuseum(
  scrapedName: string,
  museums: Museum[],
  aliases: Record<string, string>,
): Museum | null {
  const aliasId = aliases[scrapedName];
  if (aliasId) return museums.find((m) => m.id === aliasId) ?? null;

  const target = normalizeName(scrapedName);
  if (!target) return null;

  const exact = museums.filter((m) => normalizeName(m.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const partial = museums.filter((m) => {
    const norm = normalizeName(m.name);
    return containsWords(norm, target) || containsWords(target, norm);
  });
  return partial.length === 1 ? partial[0] : null;
}
