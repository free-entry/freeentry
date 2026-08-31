/**
 * Bootstrap resolver for Belgium's free-museum networks.
 *
 * Reads scripts/fixtures/be/free-museums.json (per-scheme lists verified on
 * brusselsmuseums.be, Arts&Publics/FWB, degentsemusea.be and the Antwerp
 * press record) and builds data/be/museums.json. Venues appearing in several
 * schemes are merged; each rule cites the page its scheme was read on.
 *
 * Identity: Wikidata via French/Dutch label search + frwiki/nlwiki full-text
 * fallback; coordinates from P625; postal code from P281 else photon reverse
 * geocoding; province derived from the postal range.
 *
 * Usage: npx tsx scripts/sources/be/build-be.ts [--limit=N]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const WD_API = 'https://www.wikidata.org/w/api.php';
const UA = 'free-museums-belgium-build/1.0 (https://freeentry.org/free-museums-belgium/; tomchen.org@gmail.com)';
const TODAY = '2026-08-06';
const BE = { minLat: 49.45, maxLat: 51.6, minLng: 2.4, maxLng: 6.5 };

const NOTES = {
  firstWednesday: 'Free on the first Wednesday of the month from early afternoon.',
  ghent: 'Free for Ghent residents (postcodes 9000–9052).',
  antwerp: 'Free for Antwerp residents holding an A-kaart.',
  lateThursday: 'Late Donderdag: open until 22:00, free from 17:30 for Ghent residents; paused in July and August.',
};

interface RawVenue {
  name: string; city: string; url?: string; scheme: string;
  residentOnly?: boolean; sourceUrl: string; alwaysFree?: boolean; address?: string;
}

interface WdEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  sitelinks?: Record<string, { title: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
const STOP = new Set(['de', 'het', 'van', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'museum', 'musee', 'musée']);
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
function cleanCity(c: string): string {
  return c.replace(/\s*\(\d{4}\)\s*/, '').replace(/^Brussels-City$/, 'Bruxelles').trim() || 'Bruxelles';
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
  for (const lang of ['fr', 'nl', 'en']) {
    const data = (await api(WD_API, {
      action: 'wbsearchentities', search: name, language: lang, uselang: lang, type: 'item', limit: '7',
    })) as { search?: { id: string }[] };
    for (const h of data.search ?? []) ids.add(h.id);
    await sleep(80);
  }
  for (const wiki of ['fr', 'nl', 'en']) {
    const data = (await api(`https://${wiki}.wikipedia.org/w/api.php`, {
      action: 'query', generator: 'search', gsrsearch: `${name} ${city}`, gsrlimit: '4',
      prop: 'pageprops', ppprop: 'wikibase_item',
    })) as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } };
    for (const p of Object.values(data.query?.pages ?? {})) {
      if (p.pageprops?.wikibase_item) ids.add(p.pageprops.wikibase_item);
    }
    await sleep(80);
  }
  return [...ids];
}

async function fetchEntities(ids: string[]): Promise<Map<string, WdEntity>> {
  const map = new Map<string, WdEntity>();
  for (let i = 0; i < ids.length; i += 50) {
    const data = (await api(WD_API, {
      action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'),
      props: 'labels|aliases|claims|sitelinks', languages: 'fr|nl|en', sitefilter: 'frwiki',
    })) as { entities?: Record<string, WdEntity> };
    for (const [id, e] of Object.entries(data.entities ?? {})) map.set(id, e);
    await sleep(100);
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
  for (const lang of ['fr', 'nl', 'en']) {
    if (e.labels?.[lang]) names.push(e.labels[lang].value);
    for (const a of e.aliases?.[lang] ?? []) names.push(a.value);
  }
  return Math.max(0, ...names.map((n) => similarity(name, n)));
}

async function photonSearch(address: string): Promise<{ coords: [number, number]; postcode: string } | null> {
  try {
    const res = await fetch(
      `https://photon.komoot.io/api?q=${encodeURIComponent(address + ', Belgium')}&limit=1`,
      { headers: { 'User-Agent': UA } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] }; properties?: { postcode?: string } }[];
    };
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    let pc = f?.properties?.postcode?.split(/[;,]/)[0]?.trim();
    if (!pc) {
      const m = address.match(/\b(\d{4})\b/);
      pc = m?.[1];
    }
    if (!coords || !pc || !/^\d{4}$/.test(pc)) return null;
    return { coords: [Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6))], postcode: pc };
  } catch {
    return null;
  }
}

async function photonPostcode(lng: number, lat: number): Promise<string | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { properties?: { postcode?: string } }[] };
    const pc = data.features?.[0]?.properties?.postcode?.split(/[;,]/)[0]?.trim();
    return pc && /^\d{4}$/.test(pc) ? pc : null;
  } catch {
    return null;
  }
}

function provinceOf(postcode: string): string | null {
  const n = Number(postcode);
  const ranges: [string, number, number][] = [
    ['BRU', 1000, 1299], ['WBR', 1300, 1499], ['VBR', 1500, 1999], ['ANT', 2000, 2999],
    ['VBR', 3000, 3499], ['LIM', 3500, 3999], ['LIE', 4000, 4999], ['NAM', 5000, 5999],
    ['HAI', 6000, 6599], ['LUX', 6600, 6999], ['HAI', 7000, 7999], ['WVL', 8000, 8999],
    ['OVL', 9000, 9999],
  ];
  for (const [code, lo, hi] of ranges) if (n >= lo && n <= hi) return code;
  return null;
}

interface Scheme { kind: string; sourceUrl: string; note?: string }

function rulesFor(schemes: Scheme[]): Record<string, unknown>[] {
  const rules: Record<string, unknown>[] = [];
  for (const s of schemes) {
    const source = { url: s.sourceUrl, checkedAt: TODAY };
    switch (s.kind) {
      case 'alwaysFree':
        rules.push({ kind: 'always', source });
        break;
      case 'firstSunday':
        rules.push({ kind: 'nth-weekday', nth: 1, weekday: 'sunday', source });
        break;
      case 'firstWednesday':
        rules.push({ kind: 'nth-weekday', nth: 1, weekday: 'wednesday', note: NOTES.firstWednesday, source });
        break;
      case 'firstSundayResidents':
        rules.push({ kind: 'nth-weekday', nth: 1, weekday: 'sunday', audience: 'residents', note: NOTES.ghent, source });
        break;
      case 'lateThursday':
        rules.push({ kind: 'weekly', weekday: 'thursday', evening: true, audience: 'residents', note: NOTES.lateThursday, source });
        break;
      case 'firstTuesdayResidents':
        rules.push({ kind: 'nth-weekday', nth: 1, weekday: 'tuesday', audience: 'residents', note: NOTES.antwerp, source });
        break;
    }
  }
  // Dedupe identical kind+weekday+audience combos.
  const seen = new Set<string>();
  return rules.filter((r) => {
    const key = `${r.kind}|${r.weekday ?? ''}|${r.audience ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const raw = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../fixtures/be/free-museums.json'), 'utf-8'),
  );

  // Pool venues, merging schemes per normalized name+city.
  const pool = new Map<string, { name: string; city: string; url?: string; address?: string; schemes: Scheme[] }>();
  function add(v: RawVenue, kind: string) {
    const city = cleanCity(v.city ?? '');
    const key = `${normalize(v.name)}|${normalize(city)}`;
    const cur = pool.get(key) ?? { name: v.name, city, url: v.url, address: v.address, schemes: [] };
    cur.url = cur.url ?? v.url;
    cur.address = cur.address ?? v.address;
    cur.schemes.push({ kind, sourceUrl: v.sourceUrl });
    pool.set(key, cur);
  }
  for (const v of raw.brussels.firstSunday as RawVenue[]) add(v, 'firstSunday');
  for (const v of raw.brussels.firstWednesday as RawVenue[]) add(v, 'firstWednesday');
  for (const v of raw.brussels.alwaysFree as RawVenue[]) add(v, 'alwaysFree');
  for (const v of raw.fwb as RawVenue[]) {
    const kind = v.alwaysFree || v.scheme === 'alwaysFree' ? 'alwaysFree' : v.scheme;
    add(v, kind === 'firstWednesday' ? 'firstWednesday' : kind === 'alwaysFree' ? 'alwaysFree' : 'firstSunday');
    if (v.alwaysFree && v.scheme === 'firstSunday') add(v, 'firstSunday');
  }
  for (const v of raw.ghent.lateThursday.venues as RawVenue[]) add(v, 'lateThursday');
  for (const v of (raw.ghent.firstSundayResidents.venues ?? raw.ghent.firstSundayResidents) as RawVenue[]) {
    add(v, 'firstSundayResidents');
  }
  const antwerp = raw.antwerp.firstTuesdayAKaart;
  for (const v of (antwerp.venues ?? antwerp) as RawVenue[]) {
    add(v, v.scheme === 'alwaysFree' || /middelheim/i.test(v.name) ? 'alwaysFree' : 'firstTuesdayResidents');
  }

  let entries = [...pool.values()];
  if (Number.isFinite(limit)) entries = entries.slice(0, limit);
  console.log(`${entries.length} unique venues pooled`);

  let venues: Record<string, unknown>[] = [];
  try {
    venues = JSON.parse(readFileSync(join(ROOT, 'data/be/museums.json'), 'utf-8'));
  } catch { /* first run */ }
  const unresolved: string[] = [];
  const seenIds = new Set<string>(venues.map((v) => String(v.id)));
  const seenQids = new Set<string>(venues.map((v) => String(v.wikidata)));
  const resolvedNames = new Set(venues.map((v) => `${normalize(String(v.name))}`));
  let done = 0;

  for (const entry of entries) {
    if (resolvedNames.has(normalize(entry.name))) continue;
    try {
      const ids = await candidates(entry.name, entry.city);
      const entities = await fetchEntities(ids);
      let best: { e: WdEntity; score: number } | null = null;
      for (const e of entities.values()) {
        const coord = coordOf(e);
        const inBe = coord !== null &&
          coord[1] > BE.minLat && coord[1] < BE.maxLat &&
          coord[0] > BE.minLng && coord[0] < BE.maxLng;
        const sim = bestSim(entry.name, e);
        if (!(sim >= 0.55 && inBe)) continue;
        const score = sim + (inBe ? 0.5 : 0);
        if (!best || score > best.score) best = { e, score };
      }
      if (!best) {
        // No Wikidata identity — many small FWB museums have none. Fall back
        // to geocoding the address the FWB directory itself provides.
        if (entry.address) {
          await sleep(400);
          const geo = await photonSearch(entry.address);
          if (geo) {
            const province = provinceOf(geo.postcode);
            if (province) {
              let id = slugify(entry.name);
              while (seenIds.has(id)) id = `${id}-${normalize(entry.city).replace(/\s+/g, '-')}`;
              seenIds.add(id);
              venues.push({
                id,
                name: entry.name,
                coordinates: geo.coords,
                address: entry.address.replace(/\s+\d{4}\s+.*$/, ''),
                postalCode: geo.postcode,
                commune: entry.city,
                department: province,
                ...(entry.url ? { website: entry.url } : {}),
                tags: ['museum'],
                freeAccess: rulesFor(entry.schemes),
              });
              done++;
              continue;
            }
          }
        }
        unresolved.push(`${entry.name} (${entry.city}) — no confident match among ${ids.length}`);
        continue;
      }
      const e = best.e;
      if (seenQids.has(e.id)) {
        unresolved.push(`${entry.name} (${entry.city}) — ${e.id} already claimed`);
        continue;
      }
      const coord = coordOf(e);
      if (!coord) {
        unresolved.push(`${entry.name} — ${e.id} has no coordinates`);
        continue;
      }
      let postal: string | null = claimStrings(e, 'P281')[0]?.split(/[,;–-]/)[0]?.trim() ?? null;
      if (postal && !/^\d{4}$/.test(postal)) postal = null;
      if (!postal) {
        await sleep(400);
        postal = await photonPostcode(coord[0], coord[1]);
      }
      if (!postal) {
        unresolved.push(`${entry.name} — ${e.id}: no postal code`);
        continue;
      }
      const province = provinceOf(postal);
      if (!province) {
        unresolved.push(`${entry.name} — postal ${postal} outside Belgian ranges`);
        continue;
      }
      let id = slugify(entry.name);
      while (seenIds.has(id)) id = `${id}-${normalize(entry.city).replace(/\s+/g, '-')}`;
      seenIds.add(id);
      seenQids.add(e.id);
      const frwiki = e.sitelinks?.frwiki?.title;
      const website = claimStrings(e, 'P856')[0] ?? entry.url;
      venues.push({
        id,
        name: e.labels?.fr?.value ?? e.labels?.nl?.value ?? entry.name,
        coordinates: [Number(coord[0].toFixed(6)), Number(coord[1].toFixed(6))],
        address: '',
        postalCode: postal,
        commune: entry.city,
        department: province,
        ...(website ? { website } : {}),
        tags: ['museum'],
        freeAccess: rulesFor(entry.schemes),
        wikidata: e.id,
        ...(frwiki
          ? { wikipedia: `https://fr.wikipedia.org/wiki/${encodeURIComponent(frwiki.replace(/ /g, '_'))}` }
          : {}),
      });
      done++;
      if (done % 25 === 0) console.log(`…${done} resolved`);
    } catch (err) {
      unresolved.push(`${entry.name} — error: ${String(err)}`);
    }
  }

  venues.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
  writeFileSync(join(ROOT, 'data/be/museums.json'), `${JSON.stringify(venues, null, 2)}\n`);
  console.log(`\n${venues.length} venues written to data/be/museums.json; ${unresolved.length} unresolved:`);
  for (const u of unresolved) console.log(`  ! ${u}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
