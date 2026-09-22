/**
 * Cross-checks data/museums.json against Wikidata — an outside opinion keyed
 * on the museum's identity rather than on the sources our facts came from,
 * so it can catch self-consistent wrong answers (wrong coordinates, renamed
 * or deleted articles, redirected items).
 *
 * Reports and exits 1 on:
 *  - QIDs that no longer exist or are redirected (--write follows redirects)
 *  - coordinate disagreement > 0.6 km between our record and P625
 *  - frwiki article drift: our wikipedia no longer matches the sitelink
 *    (--write refreshes it), or a stored article that disappeared
 *
 * Info only (no failure): items without P625, official-website host
 * mismatches (P856), museums without a QID.
 *
 * Usage: npx tsx scripts/check-wikidata.ts [--write]
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineKm } from '../src/lib/distance';
import type { Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const COUNTRY = process.env.COUNTRY ?? 'fr';
const MUSEUMS_PATH = join(ROOT, `data/${COUNTRY}/museums.json`);
// Wikipedia links follow the country's canonical language.
const WIKI_LANG: Record<string, string> = { fr: 'fr', it: 'it', be: 'fr' };
const WIKI = WIKI_LANG[COUNTRY] ?? 'fr';
const API = 'https://www.wikidata.org/w/api.php';
const UA = 'freeentry-check/1.0 (https://freeentry.org/france/; tomchen.org@gmail.com)';
const DISAGREEMENT_KM = 0.6;

/**
 * Disagreements a human has already arbitrated (BAN address geocoding as the
 * third opinion) where OUR value is the right one. Reported as notes, not
 * failures. Re-litigate an entry only if the museum moves or the reason
 * stops being true.
 */
const ACKNOWLEDGED_COORDS: Record<string, string> = {
  // Merged from the free-museums-paris sibling; BAN geocoding of the stored
  // address matches our point exactly for both (arbitrated 2026-08-21).
  // Q3330662 claims the museum is in Saint-Germain-en-Laye (P131 Q185075) yet
  // puts its P625 11 km south of that commune — internally inconsistent.
  'musee-municipal-ducastel-vera-de-saint-germain-en-laye':
    'BAN puts 2 rue Henri-IV 78100 at our exact point; Q3330662 P625 contradicts its own P131',
  // BAN resolves "Rond Point René Ravaud 77550 Réau" to our point, score 0.94.
  'musee-aeronautique-et-spatial-safran': 'BAN agrees with us; Q20971130 P625 is 1.40 km out',
  // BAN puts the address 0.04 km from our point; the item's P625 is 2.5 km out (2026-08-06).
  'musee-bossuet': 'BAN agrees with us; Wikidata P625 is wrong',
  // Museum moved to place Denfert-Rochereau in 2019; BAN confirms our point (2026-08-06).
  'musee-de-la-liberation-de-paris-musee-du-general-leclerc-musee-jean-moulin':
    'BAN agrees with us; Wikidata P625 still shows another site',
  // BAN puts 14 rue Max Blondat 0.00 km from our point (2026-08-06).
  'musee-jardin-paul-landowski': 'BAN agrees with us; Wikidata P625 is wrong',
  // FR city expansion: BAN address geocoding matches our point exactly for
  // all five; the linked item's P625 is the off side (arbitrated 2026-08-07).
  'crypte-archeologique-notre-dame-du-bourg': 'BAN agrees with us; Q181306 P625 is 0.67 km out',
  'la-kunsthalle-mulhouse': 'BAN agrees with us; Q79815 P625 is 1.19 km out',
  'mo-co-hotel-des-collections': 'BAN agrees with us; Q65158405 P625 is 1.39 km out',
  'site-memorial-du-camp-des-milles': 'BAN agrees with us; Q481647 P625 is 0.75 km out',
  'musee-de-l-ecole-nationale-superieure-des-beaux-arts':
    'BAN puts 14 rue Bonaparte on our point; Q88640485 P625 is 1.21 km out',
  // The museum left Paris in 2013 and reopened at the Allianz Riviera in Nice
  // in 2014; Q3330734's P625 still shows the old Paris site (2026-08-07).
  'musee-national-du-sport': 'moved to Nice in 2014; Wikidata P625 still shows Paris',
  // IT: large archaeological sites — our point is the visitor entrance, the
  // item's P625 the ancient-city/park centroid (identity audit, 2026-08-06).
  'area-archeologica-di-conza': 'entrance point kept; Q5157069 P625 is the Compsa centroid',
  'area-archeologica-di-nervia': 'entrance point kept; Q3608794 P625 is the Albintimilium centroid',
  'parco-delle-incisioni-rupestri-con-rupe-magna-di-grosio':
    'entrance point kept; Q21234614 P625 sits at the castle end of the park',
  'santuario-di-minerva-di-breno': 'entrance point kept; Q3949899 P625 is off by the site extent',
};

interface WdEntity {
  id: string;
  missing?: string;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  sitelinks?: Record<string, { title: string }>;
}

function wikiUrl(title: string): string {
  return `https://${WIKI}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function fetchEntities(ids: string[]): Promise<Map<string, WdEntity>> {
  const map = new Map<string, WdEntity>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `${API}?${new URLSearchParams({
      format: 'json',
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'claims|sitelinks',
      sitefilter: `${WIKI}wiki`,
    })}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = (await res.json()) as { entities?: Record<string, WdEntity> };
    // Redirects come back keyed by the requested id with the target's id inside.
    for (const [requested, entity] of Object.entries(data.entities ?? {})) {
      map.set(requested, entity);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return map;
}

async function main() {
  const write = process.argv.includes('--write');
  const museums: Museum[] = JSON.parse(readFileSync(MUSEUMS_PATH, 'utf-8'));
  const linked = museums.filter((m) => m.wikidata);
  const entities = await fetchEntities(linked.map((m) => m.wikidata as string));

  const problems: string[] = [];
  const info: string[] = [];
  let fixed = 0;

  for (const m of linked) {
    const qid = m.wikidata as string;
    const entity = entities.get(qid);
    if (!entity || entity.missing !== undefined) {
      problems.push(`${m.id}: ${qid} no longer exists on Wikidata`);
      continue;
    }
    if (entity.id !== qid) {
      if (write) {
        m.wikidata = entity.id;
        fixed++;
        info.push(`${m.id}: ${qid} redirected → ${entity.id} (updated)`);
      } else {
        problems.push(`${m.id}: ${qid} redirected → ${entity.id} (run --write to follow)`);
      }
    }

    const coordClaim = entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value as
      | { latitude: number; longitude: number }
      | undefined;
    if (coordClaim) {
      const dist = haversineKm(m.coordinates, [coordClaim.longitude, coordClaim.latitude]);
      if (dist > DISAGREEMENT_KM) {
        if (m.id in ACKNOWLEDGED_COORDS) {
          info.push(
            `${m.id}: ${dist.toFixed(2)} km from ${qid}, acknowledged — ${ACKNOWLEDGED_COORDS[m.id]}`,
          );
        } else {
          problems.push(
            `${m.id}: coordinates disagree with ${qid} by ${dist.toFixed(2)} km — verify which side is right (BAN address geocoding makes a good third opinion)`,
          );
        }
      } else if (m.id in ACKNOWLEDGED_COORDS) {
        info.push(`${m.id}: acknowledged disagreement resolved upstream — remove the entry`);
      }
    } else {
      info.push(`${m.id}: ${qid} has no coordinates to check against`);
    }

    const title = entity.sitelinks?.[`${WIKI}wiki`]?.title;
    const expected = title ? wikiUrl(title) : undefined;
    if (expected !== m.wikipedia) {
      if (write) {
        if (expected) m.wikipedia = expected;
        else delete m.wikipedia;
        fixed++;
        info.push(`${m.id}: wikipedia refreshed (${m.wikipedia ?? 'removed'})`);
      } else {
        problems.push(
          `${m.id}: wikipedia drifted — stored ${m.wikipedia ?? 'none'}, sitelink says ${expected ?? 'none'} (run --write)`,
        );
      }
    }

    const site = entity.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (typeof site === 'string' && m.website) {
      const ours = hostname(m.website);
      const theirs = hostname(site);
      if (ours && theirs && ours !== theirs) {
        info.push(`${m.id}: website host differs (ours ${ours}, ${qid} says ${theirs})`);
      }
    }
  }

  for (const m of museums) {
    if (!m.wikidata) info.push(`${m.id}: no Wikidata item linked`);
  }

  console.log(
    `Checked ${linked.length} linked museums: ${problems.length} problem(s), ${fixed} fixed, ${info.length} note(s).`,
  );
  for (const line of info) console.log(`  ~ ${line}`);
  if (problems.length) {
    console.log('\nProblems:');
    for (const line of problems) console.log(`  ! ${line}`);
    process.exitCode = 1;
  }

  if (write && fixed > 0) {
    const tmp = `${MUSEUMS_PATH}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(museums, null, 2)}\n`);
    renameSync(tmp, MUSEUMS_PATH);
    console.log(`Wrote ${MUSEUMS_PATH}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
