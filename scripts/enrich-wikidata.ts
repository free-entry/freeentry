/**
 * Links every museum in data/museums.json to its Wikidata item and French
 * Wikipedia article: sets `wikidata` (QID) and `wikipedia` (article URL).
 *
 * Matching: wbsearchentities candidates for the French name, verified against
 * P625 coordinates (distance to our record), P856 official website and label
 * similarity. Low-confidence matches are reported for manual review and can be
 * pinned via OVERRIDES.
 *
 * Usage: npx tsx scripts/enrich-wikidata.ts [--dry-run] [--force]
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineKm } from '../src/lib/distance';
import type { Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const COUNTRY = process.env.COUNTRY ?? 'fr';
const MUSEUMS_PATH = join(ROOT, `data/${COUNTRY}/museums.json`);
const API = 'https://www.wikidata.org/w/api.php';
const UA = 'free-museums-france-enrich/1.0 (https://freemuseums.app/free-museums-france/; tomchen.org@gmail.com)';

/** Hand-verified matches the heuristics can't settle; null = no Wikidata item. */
const OVERRIDES: Record<string, string | null> = {
  // Museum item, not the castle building it occupies.
  'chateau-musee-de-nemours': 'Q131561076',
  // Écomusée de Fresnes — the shared municipal website domain made the
  // commune item outscore it.
  'ecomusee-94260': 'Q23639828',
  // Only the Berlin and Warsaw Europa Experience venues have items.
  'europa-experience': null,
  'musee-archeologique-departemental-du-val-d-oise': 'Q2420675',
  // Q2597719 (musée de la Franc-maçonnerie) is the Grand Orient's museum,
  // a different institution; the GLDF museum has no item.
  'musee-de-la-grande-loge-de-france': null,
  // Museum item; Q22915876 is the villa Médicis building itself.
  'musee-de-saint-maur-villa-medicis': 'Q23639850',
  // The shared madparis.fr domain pulled in the Arts décoratifs item.
  'musee-nissim-de-camondo-union-centrale-des-arts-decoratifs': 'Q1954498',
  // Villa des Brillants, the Rodin museum's Meudon site.
  'musee-rodin-meudon': 'Q3558853',
  // No dedicated item for the towers visit; the cathedral item Q2981 is
  // already linked from cathedrale-notre-dame-de-paris.
  'tours-de-notre-dame-de-paris': null,
};

interface WdEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, unknown[]>;
  sitelinks?: Record<string, { title: string }>;
}

type Claim = {
  mainsnak?: { datavalue?: { value?: unknown } };
};

function coordOf(entity: WdEntity): [number, number] | null {
  const claim = (entity.claims?.P625 as Claim[] | undefined)?.[0];
  const v = claim?.mainsnak?.datavalue?.value as
    | { latitude: number; longitude: number }
    | undefined;
  return v ? [v.longitude, v.latitude] : null;
}

function websitesOf(entity: WdEntity): string[] {
  const claims = (entity.claims?.P856 as Claim[] | undefined) ?? [];
  return claims
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v): v is string => typeof v === 'string');
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(['musee', 'museum', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'a', 'au', 'aux']);

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t && !STOPWORDS.has(t)));
}

/** Jaccard similarity over significant tokens. */
function labelSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return normalize(a) === normalize(b) ? 1 : 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function bestLabelSimilarity(museum: Museum, entity: WdEntity): number {
  const names: string[] = [];
  for (const lang of ['fr', 'en']) {
    const label = entity.labels?.[lang]?.value;
    if (label) names.push(label);
    for (const alias of entity.aliases?.[lang] ?? []) names.push(alias.value);
  }
  return Math.max(0, ...names.map((n) => labelSimilarity(museum.name, n)));
}

async function api(params: Record<string, string>): Promise<unknown> {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Name variants worth searching: full, before comma/dash separators. */
function searchVariants(name: string): string[] {
  const variants = [name];
  const beforeComma = name.split(',')[0].trim();
  if (beforeComma !== name) variants.push(beforeComma);
  const beforeDash = name.split(' - ')[0].trim();
  if (!variants.includes(beforeDash)) variants.push(beforeDash);
  return variants;
}

async function searchCandidates(name: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const variant of searchVariants(name)) {
    for (const language of ['fr', 'en']) {
      const data = (await api({
        action: 'wbsearchentities',
        search: variant,
        language,
        uselang: 'fr',
        type: 'item',
        limit: '7',
      })) as { search?: { id: string }[] };
      for (const hit of data.search ?? []) ids.add(hit.id);
      await sleep(60);
      // One language pass is enough once the full name already hit.
      if (language === 'fr' && ids.size >= 5 && variant === name) break;
    }
  }
  return [...ids];
}

/**
 * Fallback for names wbsearchentities can't prefix-match (word order, extra
 * qualifiers): full-text search on French Wikipedia, mapped to Wikidata ids.
 */
async function frwikiCandidates(name: string): Promise<string[]> {
  const url = `https://fr.wikipedia.org/w/api.php?${new URLSearchParams({
    format: 'json',
    action: 'query',
    generator: 'search',
    gsrsearch: name,
    gsrlimit: '5',
    prop: 'pageprops',
    ppprop: 'wikibase_item',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> };
  };
  return Object.values(data.query?.pages ?? {})
    .map((p) => p.pageprops?.wikibase_item)
    .filter((q): q is string => q !== undefined);
}

async function fetchEntities(ids: string[]): Promise<Map<string, WdEntity>> {
  const map = new Map<string, WdEntity>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = (await api({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|aliases|claims|sitelinks',
      languages: 'fr|en',
      sitefilter: 'frwiki',
    })) as { entities?: Record<string, WdEntity> };
    for (const [id, entity] of Object.entries(data.entities ?? {})) map.set(id, entity);
    await sleep(100);
  }
  return map;
}

interface Scored {
  id: string;
  distanceKm: number | null;
  websiteMatch: boolean;
  similarity: number;
  frwiki?: string;
}

function score(museum: Museum, entity: WdEntity): Scored {
  const coord = coordOf(entity);
  const ourHost = museum.website ? hostname(museum.website) : null;
  const theirHosts = websitesOf(entity)
    .map(hostname)
    .filter((h): h is string => h !== null);
  return {
    id: entity.id,
    distanceKm: coord ? haversineKm(museum.coordinates, coord) : null,
    websiteMatch: ourHost !== null && theirHosts.includes(ourHost),
    similarity: bestLabelSimilarity(museum, entity),
    frwiki: entity.sitelinks?.frwiki?.title,
  };
}

/** A candidate is trustworthy when geography and identity both line up. */
function accepts(s: Scored): boolean {
  if (s.distanceKm !== null && s.distanceKm <= 2 && (s.similarity >= 0.5 || s.websiteMatch))
    return true;
  if (s.websiteMatch && (s.distanceKm === null || s.distanceKm <= 10) && s.similarity >= 0.3)
    return true;
  return false;
}

function frwikiUrl(title: string): string {
  return `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const museums: Museum[] = JSON.parse(readFileSync(MUSEUMS_PATH, 'utf-8'));

  const review: string[] = [];
  const unmatched: string[] = [];
  let matched = 0;
  let noFrwiki = 0;

  for (const museum of museums) {
    if (museum.wikidata && !force) continue;

    if (museum.id in OVERRIDES) {
      const qid = OVERRIDES[museum.id];
      if (qid === null) continue;
      const entities = await fetchEntities([qid]);
      const entity = entities.get(qid);
      if (!entity) throw new Error(`override ${qid} for ${museum.id} not found`);
      museum.wikidata = qid;
      const title = entity.sitelinks?.frwiki?.title;
      if (title) museum.wikipedia = frwikiUrl(title);
      matched++;
      continue;
    }

    const candidateIds = await searchCandidates(museum.name);
    const rank = (list: Scored[]) =>
      list.sort((a, b) => {
        const da = a.distanceKm ?? Infinity;
        const db = b.distanceKm ?? Infinity;
        return b.similarity + (b.websiteMatch ? 1 : 0) - (a.similarity + (a.websiteMatch ? 1 : 0)) || da - db;
      });
    let entities = await fetchEntities(candidateIds);
    let scored = rank([...entities.values()].map((e) => score(museum, e)));
    let winner = scored.find(accepts);

    if (!winner) {
      const extra = (await frwikiCandidates(museum.name)).filter((q) => !entities.has(q));
      await sleep(60);
      if (extra.length > 0) {
        for (const [id, e] of await fetchEntities(extra)) entities.set(id, e);
        scored = rank([...entities.values()].map((e) => score(museum, e)));
        winner = scored.find(accepts);
      }
    }

    if (!winner) {
      const top = scored[0];
      unmatched.push(
        top
          ? `${museum.id} — best ${top.id} sim=${top.similarity.toFixed(2)} dist=${top.distanceKm?.toFixed(2) ?? '?'}km web=${top.websiteMatch}`
          : `${museum.id} — no search results`,
      );
      continue;
    }

    // A second acceptable candidate close by means ambiguity worth eyeballing.
    const runnerUp = scored.filter((s) => s !== winner).find(accepts);
    if (runnerUp && runnerUp.similarity >= winner.similarity - 0.1) {
      review.push(`${museum.id} — picked ${winner.id}, runner-up ${runnerUp.id}`);
    }

    museum.wikidata = winner.id;
    if (winner.frwiki) museum.wikipedia = frwikiUrl(winner.frwiki);
    else noFrwiki++;
    matched++;
    console.log(
      `${museum.id} → ${winner.id}${winner.frwiki ? ` (${winner.frwiki})` : ' (no frwiki)'}`,
    );
  }

  console.log(`\n${matched} matched, ${noFrwiki} without frwiki article, ${unmatched.length} unmatched.`);
  if (review.length) {
    console.log('\nAmbiguous — verify manually:');
    for (const line of review) console.log(`  ? ${line}`);
  }
  if (unmatched.length) {
    console.log('\nUnmatched — resolve via OVERRIDES:');
    for (const line of unmatched) console.log(`  ? ${line}`);
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
