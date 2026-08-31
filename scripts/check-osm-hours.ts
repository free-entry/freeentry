/**
 * Cross-checks our opening hours against OpenStreetMap — an independent,
 * no-AI outside opinion. One Overpass query pulls every museum/attraction/
 * historic feature carrying an opening_hours tag inside metropolitan France; features are matched to our records by proximity plus a
 * distinctive name token (or ≤ 60 m regardless).
 *
 * Report-only. OSM is crowd-sourced: a difference means "check the official
 * site", not "OSM is right".
 *
 * Usage: npx tsx scripts/check-osm-hours.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineKm } from '../src/lib/distance';
import type { Museum } from '../src/lib/types';
import { normalizeName } from './lib/matchMuseums';

const ROOT = join(import.meta.dirname, '..');
const COUNTRY = process.env.COUNTRY ?? 'fr';
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'free-museums-france-check/1.0 (https://freeentry.org/free-museums-france/; tomchen.org@gmail.com)';
const MATCH_KM = 0.12;
const SURE_KM = 0.06;

const QUERY = `
[out:json][timeout:180];
(
  nwr["opening_hours"]["tourism"~"^(museum|attraction|gallery)$"](41.2,-5.3,51.2,9.7);
  nwr["opening_hours"]["historic"~"^(castle|monument|fort|abbey|church|city_gate|tower)$"](41.2,-5.3,51.2,9.7);
);
out center tags;
`;

interface OsmElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function coordsOf(el: OsmElement): [number, number] | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return lat !== undefined && lon !== undefined ? [lon, lat] : null;
}

const GENERIC = new Set(['art', 'histoire', 'arts', 'national', 'municipal', 'ville', 'maison', 'chateau']);

function distinctiveTokens(name: string): Set<string> {
  return new Set(normalizeName(name).split(' ').filter((t) => t && !GENERIC.has(t)));
}

/** Collapse formatting-only differences before comparing hour strings. */
function canonical(hours: string): string {
  return hours.replace(/\s+/g, ' ').replace(/, /g, ',').trim().toLowerCase();
}

async function queryOverpass(): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(QUERY)}`,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { elements?: OsmElement[] }).elements ?? [];
    } catch (err) {
      lastError = err;
      console.log(`~ ${mirror} failed (${String(err)}), trying next mirror…`);
    }
  }
  throw new Error(`All Overpass mirrors failed; last error: ${String(lastError)}`);
}

async function main() {
  const museums: Museum[] = JSON.parse(readFileSync(join(ROOT, `data/${COUNTRY}/museums.json`), 'utf-8'));
  const elements = await queryOverpass();
  console.log(`Overpass returned ${elements.length} features with opening_hours.`);

  const differs: string[] = [];
  const adoptable: string[] = [];
  let agree = 0;

  for (const m of museums) {
    const ourTokens = distinctiveTokens(m.name);
    let best: { el: OsmElement; d: number } | null = null;
    for (const el of elements) {
      const c = coordsOf(el);
      if (!c) continue;
      const d = haversineKm(m.coordinates, c);
      if (d > MATCH_KM || (best && d >= best.d)) continue;
      const osmName = el.tags?.name ?? '';
      const shared = [...distinctiveTokens(osmName)].some((t) => ourTokens.has(t));
      if (shared || d <= SURE_KM) best = { el, d };
    }
    if (!best) continue;

    const osmHours = best.el.tags?.opening_hours as string;
    if (m.openingHours) {
      if (canonical(m.openingHours) === canonical(osmHours)) agree++;
      else {
        differs.push(
          `${m.id}:\n      ours ${m.openingHours}\n      osm  ${osmHours}  (${best.el.tags?.name ?? '?'}, ${(best.d * 1000).toFixed(0)} m)`,
        );
      }
    } else {
      adoptable.push(`${m.id}: OSM says "${osmHours}" (${best.el.tags?.name ?? '?'})`);
    }
  }

  console.log(`${agree} museum(s) agree with OSM, ${differs.length} differ, ${adoptable.length} could adopt OSM hours.`);
  if (differs.length) {
    console.log('\nDiffering hours — check the official site, then update ours or fix OSM:');
    for (const line of differs) console.log(`  ~ ${line}`);
  }
  if (adoptable.length) {
    console.log('\nMuseums without hours where OSM has them (verify before adopting):');
    for (const line of adoptable) console.log(`  + ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
