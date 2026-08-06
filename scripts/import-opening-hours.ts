/**
 * Imports human-verified opening hours from the sibling free-museums-paris
 * checkout into data/museums.json, with per-museum provenance
 * (`openingHoursSource`: the page the hours were verified against, and the
 * date that verification happened).
 *
 * Matching is identity-based only — Wikidata QID first, parisjetaime record
 * id second. No name matching: a wrong merge would attach one museum's hours
 * to another, which is worse than a missing value.
 *
 * Usage: npx tsx scripts/import-opening-hours.ts [--dry-run] [--p1 <path>]
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const COUNTRY = process.env.COUNTRY ?? 'fr';
const MUSEUMS_PATH = join(ROOT, `data/${COUNTRY}/museums.json`);

interface P1Venue {
  id: string;
  status: string;
  openingHours?: string;
  sourceIds?: { wikidata?: string; parisjetaime?: string };
  links?: { official?: string };
  sources?: { url: string }[];
  lastVerified?: string;
}

interface P1Content {
  sourceId: string;
  openingHours?: string;
  openingHoursSource?: string;
  verifiedOn?: string;
}

function pidFromUrl(url: string | undefined): string | null {
  const m = url?.match(/-(p\d+)$/);
  return m ? m[1] : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const p1Flag = process.argv.indexOf('--p1');
  const p1Root =
    p1Flag !== -1 ? process.argv[p1Flag + 1] : join(ROOT, '../free-museums-paris');

  const museums: Museum[] = JSON.parse(readFileSync(MUSEUMS_PATH, 'utf-8'));
  const p1Venues: P1Venue[] = JSON.parse(
    readFileSync(join(p1Root, 'data/dist/venues.json'), 'utf-8'),
  ).venues;
  const p1Content: P1Content[] = JSON.parse(
    readFileSync(join(p1Root, 'data/venues/upstream-content.json'), 'utf-8'),
  ).venues;

  const byQid = new Map<string, P1Venue>();
  const byPid = new Map<string, P1Venue>();
  for (const v of p1Venues) {
    if (v.sourceIds?.wikidata) byQid.set(v.sourceIds.wikidata, v);
    if (v.sourceIds?.parisjetaime) byPid.set(v.sourceIds.parisjetaime, v);
  }
  const hoursSourceByPid = new Map(
    p1Content
      .filter((c) => c.openingHoursSource)
      .map((c) => [c.sourceId, c.openingHoursSource as string]),
  );

  let imported = 0;
  let skippedClosed = 0;
  const conflicts: string[] = [];
  const unmatched: string[] = [];

  for (const museum of museums) {
    const viaQid = museum.wikidata ? byQid.get(museum.wikidata) : undefined;
    const pid = pidFromUrl(museum.parisjetaimeUrl);
    const viaPid = pid ? byPid.get(pid) : undefined;

    if (viaQid && viaPid && viaQid.id !== viaPid.id) {
      // A pjt record id is per-record; a QID can legitimately be shared by a
      // venue and its annex (P1 does this for Port-Royal). Trust the pid.
      conflicts.push(`${museum.id}: QID → ${viaQid.id}, pid → ${viaPid.id} (used pid)`);
    }
    const venue = viaPid ?? viaQid;
    if (!venue) {
      unmatched.push(museum.id);
      continue;
    }
    if (venue.status !== 'open') {
      skippedClosed++;
      console.log(`~ ${museum.id}: P1 lists ${venue.id} as ${venue.status} — hours not imported`);
      continue;
    }
    if (!venue.openingHours) continue;

    const sourceUrl =
      (venue.sourceIds?.parisjetaime &&
        hoursSourceByPid.get(venue.sourceIds.parisjetaime)) ||
      venue.links?.official ||
      venue.sources?.[0]?.url;
    if (!sourceUrl) {
      console.log(`~ ${museum.id}: hours available but no citable source — skipped`);
      continue;
    }

    museum.openingHours = venue.openingHours;
    museum.openingHoursSource = {
      url: sourceUrl,
      checkedAt: venue.lastVerified ?? '2026-08-04',
    };
    imported++;
  }

  console.log(
    `\n${imported} museums received hours; ${unmatched.length} had no P1 identity match; ${skippedClosed} skipped (venue not open in P1).`,
  );
  if (conflicts.length) {
    console.log('Conflicting identities — resolve manually:');
    for (const c of conflicts) console.log(`  ! ${c}`);
  }
  if (unmatched.length) {
    console.log(`Unmatched: ${unmatched.join(', ')}`);
  }

  if (dryRun) {
    console.log('Dry run — nothing written.');
    return;
  }
  const tmp = `${MUSEUMS_PATH}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(museums, null, 2)}\n`);
  renameSync(tmp, MUSEUMS_PATH);
  console.log(`Wrote ${MUSEUMS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
