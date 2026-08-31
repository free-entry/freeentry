/**
 * Bootstrap resolver for France's city free-museum schemes.
 *
 * Reads scripts/fixtures/fr/city-schemes.json (per-city scheme lists verified
 * on the operators' official pages) and merges the venues into
 * data/fr/museums.json. Venues appearing in several schemes are merged; each
 * rule cites the page its scheme was read on.
 *
 * Identity: Wikidata via French/English label search + frwiki full-text
 * fallback; coordinates from P625; postal code from P281 else BAN geocoding
 * of the fixture address; department and arrondissement derived from the
 * postal code.
 *
 * Incremental: venues already present in data/fr/museums.json (by
 * name+commune or QID) are skipped, so re-running only touches new entries.
 *
 * Usage: npx tsx scripts/sources/fr/build-fr-cities.ts [--limit=N]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const WD_API = 'https://www.wikidata.org/w/api.php';
const BAN_API = 'https://api-adresse.data.gouv.fr';
const UA = 'free-museums-france-build/1.0 (https://freeentry.org/free-museums-france/; tomchen.org@gmail.com)';
const TODAY = '2026-08-07';
const FR = { minLat: 41.2, maxLat: 51.2, minLng: -5.3, maxLng: 9.7 };

interface RawVenue {
  name: string;
  address?: string | null;
  url?: string | null;
  city?: string | null;
  tags?: string[] | null;
  note?: string | null;
}

interface RawScheme {
  id: string;
  city: string;
  operator?: string;
  kind:
    | 'firstSunday'
    | 'firstSundayMonths'
    | 'firstSaturday'
    | 'firstSaturdayMonths'
    | 'firstWeekend'
    | 'firstWeekendMonths'
    | 'firstWeekday'
    | 'alwaysFree'
    | 'weekly';
  months?: number[] | null;
  weekday?: string | null;
  nth?: number | null;
  evening?: boolean | null;
  audience?: string | null;
  note?: string | null;
  noteReplacesSentence?: boolean | null;
  sourceUrl: string;
  quote?: string;
  venues: RawVenue[];
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
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'a', 'au', 'aux', 'museum', 'musee']);
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
  for (const lang of ['fr', 'en']) {
    const data = (await api(WD_API, {
      action: 'wbsearchentities', search: name, language: lang, uselang: lang, type: 'item', limit: '7',
    })) as { search?: { id: string }[] };
    for (const h of data.search ?? []) ids.add(h.id);
    await sleep(80);
  }
  for (const wiki of ['fr', 'en']) {
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
      props: 'labels|aliases|claims|sitelinks', languages: 'fr|en', sitefilter: 'frwiki',
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
  for (const lang of ['fr', 'en']) {
    if (e.labels?.[lang]) names.push(e.labels[lang].value);
    for (const a of e.aliases?.[lang] ?? []) names.push(a.value);
  }
  return Math.max(0, ...names.map((n) => similarity(name, n)));
}

async function banSearch(address: string): Promise<{ coords: [number, number]; postcode: string; city: string | null } | null> {
  try {
    const res = await fetch(`${BAN_API}/search/?q=${encodeURIComponent(address)}&limit=1`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number] };
        properties?: { postcode?: string; city?: string; score?: number };
      }[];
    };
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    const pc = f?.properties?.postcode;
    if (!coords || !pc || !/^\d{5}$/.test(pc) || (f?.properties?.score ?? 0) < 0.4) return null;
    return {
      coords: [Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6))],
      postcode: pc,
      city: f?.properties?.city ?? null,
    };
  } catch {
    return null;
  }
}

async function banReverse(
  lng: number,
  lat: number,
): Promise<{ postcode: string | null; city: string | null }> {
  try {
    const res = await fetch(`${BAN_API}/reverse/?lon=${lng}&lat=${lat}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { postcode: null, city: null };
    const data = (await res.json()) as {
      features?: { properties?: { postcode?: string; city?: string }[] | { postcode?: string; city?: string } }[];
    };
    const props = data.features?.[0]?.properties as { postcode?: string; city?: string } | undefined;
    const pc = props?.postcode;
    return {
      postcode: pc && /^\d{5}$/.test(pc) ? pc : null,
      city: props?.city ?? null,
    };
  } catch {
    return { postcode: null, city: null };
  }
}

function departmentOf(postal: string, lat: number): string | null {
  if (!/^\d{5}$/.test(postal)) return null;
  if (postal.startsWith('20')) return lat < 42.0 ? '2A' : '2B'; // Corsica split ≈ 42°N
  if (postal.startsWith('97') || postal.startsWith('98')) return null; // overseas: outside bbox
  return postal.slice(0, 2);
}

function arrondissementOf(postal: string, dept: string): number | undefined {
  if (dept === '75' && /^750(0[1-9]|1\d|20)$/.test(postal)) return Number(postal.slice(3));
  if (dept === '69' && /^6900[1-9]$/.test(postal)) return Number(postal.slice(4));
  if (dept === '13' && /^130(0[1-9]|1[0-6])$/.test(postal)) return Number(postal.slice(3));
  return undefined;
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function rulesFor(s: RawScheme): Record<string, unknown>[] {
  const source = { url: s.sourceUrl, checkedAt: TODAY };
  const audience = s.audience && s.audience !== 'everyone' ? { audience: s.audience } : {};
  const note = s.note
    ? { note: s.note, ...(s.noteReplacesSentence ? { noteReplacesSentence: true } : {}) }
    : {};
  const months = s.months?.length ? { months: s.months } : {};
  const needMonths = () => {
    if (!s.months?.length) throw new Error(`${s.id}: ${s.kind} without months`);
  };
  const nth = (weekday: string) => ({
    kind: 'nth-weekday', nth: s.nth ?? 1, weekday,
    ...(s.evening ? { evening: true } : {}),
    ...months, ...audience, ...note, source,
  });
  switch (s.kind) {
    case 'alwaysFree':
      return [{ kind: 'always', ...months, ...audience, ...note, source }];
    case 'firstSunday':
      return [nth('sunday')];
    case 'firstSundayMonths':
      needMonths();
      return [nth('sunday')];
    case 'firstSaturday':
      return [nth('saturday')];
    case 'firstSaturdayMonths':
      needMonths();
      return [nth('saturday')];
    case 'firstWeekend':
      return [nth('saturday'), nth('sunday')];
    case 'firstWeekendMonths':
      needMonths();
      return [nth('saturday'), nth('sunday')];
    case 'firstWeekday': {
      if (!s.weekday || !WEEKDAYS.includes(s.weekday)) throw new Error(`${s.id}: firstWeekday without valid weekday`);
      return [nth(s.weekday)];
    }
    case 'weekly': {
      if (!s.weekday || !WEEKDAYS.includes(s.weekday)) throw new Error(`${s.id}: weekly without valid weekday`);
      return [{ kind: 'weekly', weekday: s.weekday, ...months, ...audience, ...note, source }];
    }
    default:
      throw new Error(`${s.id}: unknown kind ${String((s as { kind?: string }).kind)}`);
  }
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const raw = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../fixtures/fr/city-schemes.json'), 'utf-8'),
  ) as { schemes: RawScheme[] };

  // Pool venues, merging rules per normalized name+city.
  interface Pooled {
    name: string; city: string; url?: string; address?: string;
    tags: string[]; notes: string[]; rules: Record<string, unknown>[];
  }
  const pool = new Map<string, Pooled>();
  for (const scheme of raw.schemes) {
    const rules = rulesFor(scheme);
    for (const v of scheme.venues) {
      const city = (v.city ?? scheme.city).trim();
      const key = `${normalize(v.name)}|${normalize(city)}`;
      const cur = pool.get(key) ?? {
        name: v.name, city, url: undefined, address: undefined,
        tags: [], notes: [], rules: [],
      };
      cur.url = cur.url ?? v.url ?? undefined;
      cur.address = cur.address ?? v.address ?? undefined;
      for (const t of v.tags ?? []) if (!cur.tags.includes(t)) cur.tags.push(t);
      if (v.note && !cur.notes.includes(v.note)) cur.notes.push(v.note);
      cur.rules.push(...rules);
      pool.set(key, cur);
    }
  }

  let entries = [...pool.values()];
  if (Number.isFinite(limit)) entries = entries.slice(0, limit);
  console.log(`${entries.length} unique venues pooled from ${raw.schemes.length} schemes`);

  const venues: Record<string, unknown>[] = JSON.parse(
    readFileSync(join(ROOT, 'data/fr/museums.json'), 'utf-8'),
  );
  const unresolved: string[] = [];
  const seenIds = new Set<string>(venues.map((v) => String(v.id)));
  const seenQids = new Set<string>(venues.filter((v) => v.wikidata).map((v) => String(v.wikidata)));
  const existingNameCity = new Set(
    venues.map((v) => `${normalize(String(v.name))}|${normalize(String(v.commune))}`),
  );
  let done = 0;

  function push(entry: Pooled, fields: Record<string, unknown>) {
    let id = slugify(entry.name);
    if (seenIds.has(id)) id = `${id}-${slugify(entry.city)}`;
    if (seenIds.has(id)) throw new Error(`id collision even with city suffix: ${id}`);
    seenIds.add(id);
    // Dedupe identical kind+weekday+months+audience combos (venue in several schemes).
    const ruleSeen = new Set<string>();
    const rules = entry.rules.filter((r) => {
      const key = `${r.kind}|${r.weekday ?? ''}|${JSON.stringify(r.months ?? '')}|${r.audience ?? ''}`;
      if (ruleSeen.has(key)) return false;
      ruleSeen.add(key);
      return true;
    });
    venues.push({
      id,
      name: entry.name,
      commune: entry.city,
      ...fields,
      tags: entry.tags.length ? entry.tags : ['museum'],
      freeAccess: rules,
      ...(entry.notes.length ? { note: entry.notes.join(' ') } : {}),
    });
    done++;
    if (done % 25 === 0) console.log(`…${done} resolved`);
  }

  for (const entry of entries) {
    const poolKey = `${normalize(entry.name)}|${normalize(entry.city)}`;
    if (existingNameCity.has(poolKey)) continue; // already in the dataset (or a prior run)
    try {
      const ids = await candidates(entry.name, entry.city);
      const entities = await fetchEntities(ids);
      let best: { e: WdEntity; score: number } | null = null;
      for (const e of entities.values()) {
        const coord = coordOf(e);
        const inFr = coord !== null &&
          coord[1] > FR.minLat && coord[1] < FR.maxLat &&
          coord[0] > FR.minLng && coord[0] < FR.maxLng;
        const sim = bestSim(entry.name, e);
        if (!(sim >= 0.55 && inFr)) continue;
        if (!best || sim > best.score) best = { e, score: sim };
      }
      if (!best) {
        // No Wikidata identity — small municipal museums often have none.
        // Fall back to geocoding the address the operator's portal provides.
        if (entry.address) {
          await sleep(300);
          const geo = await banSearch(entry.address);
          if (geo) {
            const dept = departmentOf(geo.postcode, geo.coords[1]);
            if (dept) {
              const arr = arrondissementOf(geo.postcode, dept);
              push(entry, {
                ...(geo.city ? { commune: geo.city } : {}),
                coordinates: geo.coords,
                address: entry.address.replace(/,?\s*\d{5}\s+.*$/, ''),
                postalCode: geo.postcode,
                department: dept,
                ...(arr !== undefined ? { arrondissement: arr } : {}),
                ...(entry.url ? { website: entry.url } : {}),
              });
              continue;
            }
          }
        }
        unresolved.push(`${entry.name} (${entry.city}) — no confident match among ${ids.length}`);
        continue;
      }
      const e = best.e;
      if (seenQids.has(e.id)) {
        console.log(`  = skip ${entry.name} (${entry.city}) — ${e.id} already in dataset`);
        continue;
      }
      const coord = coordOf(e);
      if (!coord) {
        unresolved.push(`${entry.name} — ${e.id} has no coordinates`);
        continue;
      }
      let postal: string | null = claimStrings(e, 'P281')[0]?.split(/[,;–]/)[0]?.trim() ?? null;
      if (postal && !/^\d{5}$/.test(postal)) postal = null;
      if (!postal && entry.address) {
        const m = entry.address.match(/\b(\d{5})\b/);
        postal = m?.[1] ?? null;
      }
      // BAN reverse supplies the official commune name (network venues often
      // sit in a neighbouring commune, not the scheme's city) and a postal
      // fallback.
      await sleep(250);
      const rev = await banReverse(coord[0], coord[1]);
      if (!postal) postal = rev.postcode;
      if (!postal) {
        unresolved.push(`${entry.name} — ${e.id}: no postal code`);
        continue;
      }
      const dept = departmentOf(postal, coord[1]);
      if (!dept) {
        unresolved.push(`${entry.name} — postal ${postal} unusable (overseas or malformed)`);
        continue;
      }
      seenQids.add(e.id);
      const arr = arrondissementOf(postal, dept);
      const frwiki = e.sitelinks?.frwiki?.title;
      const website = claimStrings(e, 'P856')[0] ?? entry.url;
      push(entry, {
        name: e.labels?.fr?.value ?? entry.name,
        ...(rev.city ? { commune: rev.city } : {}),
        coordinates: [Number(coord[0].toFixed(6)), Number(coord[1].toFixed(6))],
        address: entry.address ? entry.address.replace(/,?\s*\d{5}\s+.*$/, '') : '',
        postalCode: postal,
        department: dept,
        ...(arr !== undefined ? { arrondissement: arr } : {}),
        ...(website ? { website } : {}),
        wikidata: e.id,
        ...(frwiki
          ? { wikipedia: `https://fr.wikipedia.org/wiki/${encodeURIComponent(frwiki.replace(/ /g, '_'))}` }
          : {}),
      });
    } catch (err) {
      unresolved.push(`${entry.name} — error: ${String(err)}`);
    }
  }

  venues.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
  writeFileSync(join(ROOT, 'data/fr/museums.json'), `${JSON.stringify(venues, null, 2)}\n`);
  console.log(`\n${done} added; ${venues.length} venues total in data/fr/museums.json; ${unresolved.length} unresolved:`);
  for (const u of unresolved) console.log(`  ! ${u}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
