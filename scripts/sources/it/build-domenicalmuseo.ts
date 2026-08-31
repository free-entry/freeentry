/**
 * Bootstrap resolver for Italy's Domenica al Museo venues.
 *
 * Reads scripts/fixtures/it/domenicalmuseo.json (371 state venues from the
 * ministry directory, with region/province/city and cultura.gov.it detail
 * URLs) and resolves each to a Wikidata item: cultura.gov.it "described at
 * URL" (P973) or official website match is proof; otherwise Italian label
 * similarity + coordinates inside Italy + province plausibility. Postal
 * codes come from P281, else polite Nominatim reverse geocoding.
 *
 * Every venue gets the uniform national rule set, each rule citing the
 * ministry page that states it (checkedAt = the archive snapshot date the
 * pages were read at):
 *  - first Sunday of every month (domenicalmuseo)
 *  - 25 April, 2 June, 4 November national free days
 *  - under-18 free
 *
 * Usage: npx tsx scripts/sources/it/build-domenicalmuseo.ts [--limit=N]
 * Writes data/it/museums.json (full rewrite, sorted by name) and reports
 * unresolved venues for the manual/agent pass.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const WD_API = 'https://www.wikidata.org/w/api.php';
const UA = 'free-museums-italy-build/1.0 (https://freeentry.org/free-museums-italy/; tomchen.org@gmail.com)';

const CHECKED = { directory: '2026-07-07', agevolazioni: '2026-07-31' };
const SRC = {
  domenica: 'https://cultura.gov.it/domenicalmuseo',
  agevolazioni: 'https://cultura.gov.it/agevolazioni',
};
const ITALY = { minLat: 35.4, maxLat: 47.2, minLng: 6.5, maxLng: 18.7 };

interface Entry { name: string; region: string; province: string; city: string; url: string }

interface WdEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  sitelinks?: Record<string, { title: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(['di', 'del', 'della', 'dei', 'delle', 'e', 'ed', 'il', 'la', 'lo', 'le', 'i', 'gli', 'a', 'al', 'alla', 'in', 'da']);

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t && !STOP.has(t)));
}

function similarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function slugify(s: string): string {
  return normalize(s).replace(/\s+/g, '-');
}

async function api(base: string, params: Record<string, string>): Promise<unknown> {
  const res = await fetch(`${base}?${new URLSearchParams({ format: 'json', ...params })}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`${res.status} for ${base}`);
  return res.json();
}

async function candidates(name: string, city: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const search of [name, `${name} ${city}`]) {
    const data = (await api(WD_API, {
      action: 'wbsearchentities', search, language: 'it', uselang: 'it', type: 'item', limit: '7',
    })) as { search?: { id: string }[] };
    for (const h of data.search ?? []) ids.add(h.id);
    await sleep(150);
    if (ids.size >= 6) break;
  }
  const wiki = (await api('https://it.wikipedia.org/w/api.php', {
    action: 'query', generator: 'search', gsrsearch: `${name} ${city}`, gsrlimit: '5',
    prop: 'pageprops', ppprop: 'wikibase_item',
  })) as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } };
  for (const p of Object.values(wiki.query?.pages ?? {})) {
    if (p.pageprops?.wikibase_item) ids.add(p.pageprops.wikibase_item);
  }
  await sleep(150);
  return [...ids];
}

async function fetchEntities(ids: string[]): Promise<Map<string, WdEntity>> {
  const map = new Map<string, WdEntity>();
  for (let i = 0; i < ids.length; i += 50) {
    const data = (await api(WD_API, {
      action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'),
      props: 'labels|aliases|claims|sitelinks', languages: 'it|en', sitefilter: 'itwiki',
    })) as { entities?: Record<string, WdEntity> };
    for (const [id, e] of Object.entries(data.entities ?? {})) map.set(id, e);
    await sleep(180);
  }
  return map;
}

function claimStrings(e: WdEntity, prop: string): string[] {
  return (e.claims?.[prop] ?? [])
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v): v is string => typeof v === 'string');
}

function coordOf(e: WdEntity): [number, number] | null {
  const v = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value as
    | { latitude: number; longitude: number } | undefined;
  return v ? [v.longitude, v.latitude] : null;
}

function bestSim(name: string, e: WdEntity): number {
  const names: string[] = [];
  for (const lang of ['it', 'en']) {
    if (e.labels?.[lang]) names.push(e.labels[lang].value);
    for (const a of e.aliases?.[lang] ?? []) names.push(a.value);
  }
  return Math.max(0, ...names.map((n) => similarity(name, n)));
}

async function nominatimPostcode(lng: number, lat: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': UA } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: { postcode?: string } };
    const pc = data.address?.postcode;
    return pc && /^\d{5}$/.test(pc) ? pc : null;
  } catch {
    return null;
  }
}

function nationalRules() {
  return [
    {
      kind: 'nth-weekday', nth: 1, weekday: 'sunday',
      source: { url: SRC.domenica, checkedAt: CHECKED.directory },
    },
    { kind: 'annual-date', date: '04-25', source: { url: SRC.domenica, checkedAt: CHECKED.directory } },
    { kind: 'annual-date', date: '06-02', source: { url: SRC.domenica, checkedAt: CHECKED.directory } },
    { kind: 'annual-date', date: '11-04', source: { url: SRC.domenica, checkedAt: CHECKED.directory } },
    { kind: 'always', audience: 'under-18', source: { url: SRC.agevolazioni, checkedAt: CHECKED.agevolazioni } },
  ];
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  let entries: Entry[] = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../fixtures/it/domenicalmuseo.json'), 'utf-8'),
  );
  if (Number.isFinite(limit)) entries = entries.slice(0, limit);

  // Incremental: keep venues already resolved in a previous run.
  let venues: Record<string, unknown>[] = [];
  try {
    venues = JSON.parse(readFileSync(join(ROOT, 'data/it/museums.json'), 'utf-8'));
  } catch { /* first run */ }
  const unresolved: string[] = [];
  const seenIds = new Set<string>(venues.map((v) => String(v.id)));
  const seenQids = new Set<string>(venues.map((v) => String(v.wikidata)));
  const resolvedNames = new Set(venues.map((v) => String(v.name)));
  let done = 0;

  for (const entry of entries) {
    if (resolvedNames.has(entry.name)) continue;
    try {
      const ids = await candidates(entry.name, entry.city);
      const entities = await fetchEntities(ids);
      let best: { e: WdEntity; score: number } | null = null;
      for (const e of entities.values()) {
        const coord = coordOf(e);
        const inItaly = coord !== null &&
          coord[1] > ITALY.minLat && coord[1] < ITALY.maxLat &&
          coord[0] > ITALY.minLng && coord[0] < ITALY.maxLng;
        const culturaMatch = [...claimStrings(e, 'P973'), ...claimStrings(e, 'P856')]
          .some((u) => u.includes('cultura.gov.it') && entry.url.endsWith(u.split('cultura.gov.it')[1] ?? '###'));
        const sim = bestSim(entry.name, e);
        if (!culturaMatch && !(sim >= 0.55 && inItaly)) continue;
        const score = (culturaMatch ? 2 : 0) + sim + (inItaly ? 0.5 : 0);
        if (!best || score > best.score) best = { e, score };
      }
      if (!best) {
        unresolved.push(`${entry.name} (${entry.city}) — no confident match among ${ids.length}`);
        continue;
      }
      const e = best.e;
      if (seenQids.has(e.id)) {
        unresolved.push(`${entry.name} (${entry.city}) — ${e.id} already claimed (duplicate?)`);
        continue;
      }
      const coord = coordOf(e);
      if (!coord) {
        unresolved.push(`${entry.name} — ${e.id} has no coordinates`);
        continue;
      }
      let postal: string | null = claimStrings(e, 'P281')[0]?.split(/[,;–-]/)[0]?.trim() ?? null;
      if (postal && !/^\d{5}$/.test(postal)) postal = null;
      if (!postal) {
        await sleep(1100); // Nominatim policy: max 1 req/s.
        postal = await nominatimPostcode(coord[0], coord[1]);
      }
      if (!postal) {
        unresolved.push(`${entry.name} — ${e.id}: no postal code (P281 or reverse)`);
        continue;
      }
      let id = slugify(entry.name);
      while (seenIds.has(id)) id = `${id}-${entry.province.toLowerCase()}`;
      seenIds.add(id);
      seenQids.add(e.id);
      const itwiki = e.sitelinks?.itwiki?.title;
      const website = claimStrings(e, 'P856')[0];
      venues.push({
        id,
        name: entry.name,
        coordinates: [Number(coord[0].toFixed(6)), Number(coord[1].toFixed(6))],
        address: '',
        postalCode: postal,
        commune: entry.city,
        department: entry.province,
        ...(website ? { website } : { website: entry.url }),
        tags: ['museum'],
        freeAccess: nationalRules(),
        wikidata: e.id,
        ...(itwiki
          ? { wikipedia: `https://it.wikipedia.org/wiki/${encodeURIComponent(itwiki.replace(/ /g, '_'))}` }
          : {}),
        culturaUrl: entry.url,
      });
      done++;
      if (done % 25 === 0) console.log(`…${done} resolved`);
    } catch (err) {
      unresolved.push(`${entry.name} — error: ${String(err)}`);
    }
  }

  venues.sort((a, b) => String(a.name).localeCompare(String(b.name), 'it'));
  writeFileSync(join(ROOT, 'data/it/museums.json'), `${JSON.stringify(venues, null, 2)}\n`);
  console.log(`\n${venues.length} venues written to data/it/museums.json; ${unresolved.length} unresolved:`);
  for (const u of unresolved) console.log(`  ! ${u}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
