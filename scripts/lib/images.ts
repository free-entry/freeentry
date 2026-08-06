/**
 * Pure helpers for scripts/enrich-images.ts — license classification,
 * Commons metadata cleanup, and the on-disk path convention for downloaded
 * header photos.
 */

/**
 * Canonical form of a license this project is willing to redistribute, or
 * null when the license isn't recognized as one of them. Matches Wikimedia
 * Commons' `extmetadata.LicenseShortName` values (e.g. "CC BY-SA 4.0").
 */
export function classifyLicense(raw: string): string | null {
  const s = raw.trim();
  if (/^cc0/i.test(s)) return 'CC0 1.0';
  if (/public domain/i.test(s) || /^pd$/i.test(s)) return 'Public Domain';
  const bySa = s.match(/^cc[\s-]?by[\s-]?sa[\s-]?(\d\.\d)/i);
  if (bySa) return `CC BY-SA ${bySa[1]}`;
  const by = s.match(/^cc[\s-]?by[\s-]?(\d\.\d)/i);
  if (by) return `CC BY ${by[1]}`;
  return null;
}

/** Commons' Artist field is usually an HTML link — reduce it to plain text. */
export function parseArtist(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Where a museum's downloaded header photo lives, relative to /public. */
export function imagePathFor(museumId: string): string {
  return `images/museums/${museumId}.jpg`;
}
