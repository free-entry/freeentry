/**
 * Diffs data/museums.json against the official "Liste des musées franciliens"
 * register on data.gouv.fr. Report-only — the register describes accredited
 * museums, our dataset also carries monuments, churches and private venues,
 * so a human decides what to adopt.
 *
 * Reports:
 *  - register museums with no counterpart here (new/renamed → candidates)
 *  - matched museums whose phone / website / postal code / commune differ,
 *    or whose register coordinates sit > 0.25 km from ours
 *
 * Matching order: stored museofile id → name+alias resolution (matchMuseum)
 * → commune-scoped exact name → nearest neighbour within 0.5 km sharing a
 * name token. Every match is still guarded by a 1 km distance check — a name
 * match plotted in another town is reported, not trusted. --write stores the
 * museofile id on matched museums so future runs join by identity.
 *
 * Usage: npx tsx scripts/check-datagouv.ts [--fixture] [--write]
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineKm } from '../src/lib/distance';
import type { Museum } from '../src/lib/types';
import { matchMuseum, normalizeName } from './lib/matchMuseums';

const ROOT = join(import.meta.dirname, '..');
const REGISTER_URL = 'https://www.data.gouv.fr/api/1/datasets/r/6c1502c9-5080-4138-a26f-cc2168042868';
const UA = 'free-museums-france-check/1.0 (https://freeentry.org/free-museums-france/; tomchen.org@gmail.com)';
const MATCH_GUARD_KM = 1;
const COORD_DRIFT_KM = 0.25;

interface RegisterRecord {
  fields: {
    nom_officiel_du_musee?: string;
    adresse?: string;
    code_postal?: string;
    commune?: string;
    telephone?: string;
    url?: string;
    identifiant_museofile?: string;
    latitude?: number;
    longitude?: number;
  };
}

function hostname(url: string): string | null {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function loadRegister(useFixture: boolean): Promise<RegisterRecord[]> {
  if (useFixture) {
    return JSON.parse(
      readFileSync(join(import.meta.dirname, 'fixtures/fr/datagouv-museums.json'), 'utf-8'),
    );
  }
  const res = await fetch(REGISTER_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as RegisterRecord[];
  if (!Array.isArray(data) || data.length < 120) {
    throw new Error(`Register looks wrong: ${Array.isArray(data) ? data.length : typeof data} records`);
  }
  return data;
}

/** Commune-scoped exact-name match for names matchMuseum finds ambiguous. */
function matchExactInCommune(
  f: RegisterRecord['fields'],
  museums: Museum[],
): Museum | null {
  if (!f.commune) return null;
  const commune = normalizeName(f.commune);
  const target = normalizeName(f.nom_officiel_du_musee ?? '');
  const exact = museums.filter(
    (m) => normalizeName(m.commune) === commune && normalizeName(m.name) === target,
  );
  return exact.length === 1 ? exact[0] : null;
}

/** Tokens too common in museum names to prove identity on their own. */
const GENERIC_TOKENS = new Set([
  'art', 'histoire', 'arts', 'national', 'municipal', 'ville', 'maison',
  'chateau', 'ecomusee', 'intercommunal', 'departemental', 'collections',
]);

/**
 * Last-resort proximity match, only among museums no register record has
 * claimed: within 0.3 km sharing a distinctive name token, or within 0.1 km
 * regardless. Dense-Paris lesson: "shares the word 'art' within 500 m"
 * once bolted the Pompidou's register id onto the neighbouring MAHJ.
 */
function matchNearby(
  f: RegisterRecord['fields'],
  candidates: Museum[],
): Museum | null {
  if (f.longitude === undefined || f.latitude === undefined || !f.commune) return null;
  const commune = normalizeName(f.commune);
  const here: [number, number] = [f.longitude, f.latitude];
  const targetTokens = normalizeName(f.nom_officiel_du_musee ?? '')
    .split(' ')
    .filter((t) => t && !GENERIC_TOKENS.has(t));
  let best: Museum | null = null;
  let bestDist = 0.3;
  for (const m of candidates) {
    if (normalizeName(m.commune) !== commune) continue;
    const d = haversineKm(m.coordinates, here);
    if (d >= bestDist) continue;
    const distinctiveShared = normalizeName(m.name)
      .split(' ')
      .some((t) => !GENERIC_TOKENS.has(t) && targetTokens.includes(t));
    if (distinctiveShared || d < 0.1) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

async function main() {
  const useFixture = process.argv.includes('--fixture');
  const write = process.argv.includes('--write');
  const museums: Museum[] = JSON.parse(readFileSync(join(ROOT, 'data/fr/museums.json'), 'utf-8'));
  const aliases: Record<string, string> = JSON.parse(
    readFileSync(join(ROOT, 'data/fr/aliases.json'), 'utf-8'),
  );
  const register = await loadRegister(useFixture);

  const byMuseofile = new Map(
    museums.filter((m) => m.museofile).map((m) => [m.museofile as string, m]),
  );
  const unmatchedRegister: string[] = [];
  const drifts: string[] = [];
  const newIds: string[] = [];

  // Pass 1: identity (museofile) and name matches claim museums.
  const pairs: { f: RegisterRecord['fields']; museum: Museum }[] = [];
  const claimed = new Set<string>();
  const nameless: RegisterRecord['fields'][] = [];
  for (const record of register) {
    const f = record.fields;
    if (!f.nom_officiel_du_musee) continue;
    const museum =
      (f.identifiant_museofile ? byMuseofile.get(f.identifiant_museofile) : undefined) ??
      matchMuseum(f.nom_officiel_du_musee, museums, aliases) ??
      matchExactInCommune(f, museums);
    if (museum && !claimed.has(museum.id)) {
      pairs.push({ f, museum });
      claimed.add(museum.id);
    } else {
      nameless.push(f);
    }
  }
  // Pass 2: proximity fallback, only over museums nothing has claimed.
  for (const f of nameless) {
    const museum = matchNearby(f, museums.filter((m) => !claimed.has(m.id)));
    if (museum) {
      pairs.push({ f, museum });
      claimed.add(museum.id);
      drifts.push(
        `${museum.id}: matched "${f.nom_officiel_du_musee}" by proximity only — confirm before trusting`,
      );
    } else {
      unmatchedRegister.push(
        `${f.nom_officiel_du_musee} (${f.commune ?? '?'}, museofile ${f.identifiant_museofile ?? '?'})`,
      );
    }
  }

  const matched = pairs.length;
  for (const { f, museum } of pairs) {
    const name = f.nom_officiel_du_musee as string;
    if (f.identifiant_museofile && museum.museofile !== f.identifiant_museofile) {
      if (museum.museofile) {
        drifts.push(
          `${museum.id}: museofile ${museum.museofile} vs register ${f.identifiant_museofile} — identity conflict`,
        );
        continue;
      }
      newIds.push(`${museum.id} ← ${f.identifiant_museofile} ("${name}")`);
      if (write) museum.museofile = f.identifiant_museofile;
    }

    const regCoords: [number, number] | null =
      f.longitude !== undefined && f.latitude !== undefined ? [f.longitude, f.latitude] : null;
    if (regCoords && haversineKm(museum.coordinates, regCoords) > MATCH_GUARD_KM) {
      drifts.push(
        `${museum.id}: name-matched "${name}" but register plots it ${haversineKm(museum.coordinates, regCoords).toFixed(2)} km away — possible wrong match or move`,
      );
      continue;
    }

    if (regCoords) {
      const d = haversineKm(museum.coordinates, regCoords);
      if (d > COORD_DRIFT_KM) {
        drifts.push(`${museum.id}: register coordinates ${d.toFixed(2)} km from ours`);
      }
    }
    if (f.code_postal && f.code_postal !== museum.postalCode) {
      drifts.push(`${museum.id}: postal code ${museum.postalCode} vs register ${f.code_postal}`);
    }
    if (f.commune && f.commune.toLowerCase() !== museum.commune.toLowerCase()) {
      drifts.push(`${museum.id}: commune ${museum.commune} vs register ${f.commune}`);
    }
    if (f.url && museum.website) {
      const ours = hostname(museum.website);
      const theirs = hostname(f.url);
      if (ours && theirs && ours !== theirs) {
        drifts.push(`${museum.id}: website host ${ours} vs register ${theirs}`);
      }
    }
    if (f.telephone && museum.phone && f.telephone.replace(/\D/g, '') !== museum.phone.replace(/\D/g, '')) {
      drifts.push(`${museum.id}: phone ${museum.phone} vs register ${f.telephone}`);
    }
  }

  console.log(
    `Register: ${register.length} records — ${matched} matched, ${unmatchedRegister.length} without a counterpart here, ${drifts.length} field difference(s).`,
  );
  if (unmatchedRegister.length) {
    console.log('\nIn the register but not in our data (candidates to add, or alias gaps):');
    for (const line of unmatchedRegister) console.log(`  ? ${line}`);
  }
  if (drifts.length) {
    console.log('\nField differences (register is a reference, not automatically right):');
    for (const line of drifts) console.log(`  ~ ${line}`);
  }
  if (newIds.length) {
    console.log(`\nMuseofile ids ${write ? 'stored' : 'assignable (rerun with --write)'}:`);
    for (const line of newIds) console.log(`  + ${line}`);
  }

  if (write && newIds.length) {
    const path = join(ROOT, 'data/fr/museums.json');
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(museums, null, 2)}\n`);
    renameSync(tmp, path);
    console.log(`Wrote ${path}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
