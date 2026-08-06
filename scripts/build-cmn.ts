/**
 * Bootstrap resolver for Centre des monuments nationaux venues.
 *
 * Reads scripts/fixtures/cmn-monuments.json (official-site URL → "Name (dd)"),
 * resolves each monument to a Wikidata item — the monument's own website
 * domain (P856) is the primary identity proof, label similarity + coordinates
 * the fallback — then reverse-geocodes the coordinates with BAN to get the
 * postal code and commune, cross-checked against the department in the name.
 *
 * Writes resolved skeletons (no free-access rules yet — those come from the
 * per-site verification pass) to the path given by --out, and reports
 * everything it could not settle. Existing venues are skipped by QID and by
 * website host.
 *
 * Usage: npx tsx scripts/build-cmn.ts --out <staging.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const WD_API = 'https://www.wikidata.org/w/api.php';
const UA = 'free-museums-france-build/1.0 (https://travel-eu.github.io/free-museums-france/; tomchen.org@gmail.com)';

const FRANCE = { minLat: 41.2, maxLat: 51.2, minLng: -5.3, maxLng: 9.7 };

interface WdEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  sitelinks?: Record<string, { title: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'au', 'aux', 'en']);

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t && !STOPWORDS.has(t)));
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function slugify(name: string): string {
  return normalize(name).replace(/\s+/g, '-');
}

async function api(base: string, params: Record<string, string>): Promise<unknown> {
  const res = await fetch(`${base}?${new URLSearchParams({ format: 'json', ...params })}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`${res.status} for ${base}`);
  return res.json();
}

async function searchCandidates(name: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const language of ['fr', 'en']) {
    const data = (await api(WD_API, {
      action: 'wbsearchentities',
      search: name,
      language,
      uselang: 'fr',
      type: 'item',
      limit: '7',
    })) as { search?: { id: string }[] };
    for (const hit of data.search ?? []) ids.add(hit.id);
    await sleep(80);
    if (ids.size >= 5) break;
  }
  return [...ids];
}

async function fetchEntities(ids: string[]): Promise<Map<string, WdEntity>> {
  const map = new Map<string, WdEntity>();
  for (let i = 0; i < ids.length; i += 50) {
    const data = (await api(WD_API, {
      action: 'wbgetentities',
      ids: ids.slice(i, i + 50).join('|'),
      props: 'labels|aliases|claims|sitelinks',
      languages: 'fr|en',
      sitefilter: 'frwiki',
    })) as { entities?: Record<string, WdEntity> };
    for (const [id, e] of Object.entries(data.entities ?? {})) map.set(id, e);
    await sleep(100);
  }
  return map;
}

function coordOf(e: WdEntity): [number, number] | null {
  const v = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value as
    | { latitude: number; longitude: number }
    | undefined;
  return v ? [v.longitude, v.latitude] : null;
}

function websitesOf(e: WdEntity): string[] {
  return (e.claims?.P856 ?? [])
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v): v is string => typeof v === 'string');
}

function streetAddressOf(e: WdEntity): string | null {
  const v = e.claims?.P6375?.[0]?.mainsnak?.datavalue?.value as
    | { text?: string }
    | string
    | undefined;
  if (typeof v === 'string') return v;
  return v?.text ?? null;
}

function bestLabelSim(name: string, e: WdEntity): number {
  const names: string[] = [];
  for (const lang of ['fr', 'en']) {
    if (e.labels?.[lang]) names.push(e.labels[lang].value);
    for (const a of e.aliases?.[lang] ?? []) names.push(a.value);
  }
  return Math.max(0, ...names.map((n) => similarity(name, n)));
}

interface BanReverse {
  postcode?: string;
  city?: string;
  street?: string;
}

async function banReverse(lng: number, lat: number): Promise<BanReverse> {
  try {
    const data = (await api('https://api-adresse.data.gouv.fr/reverse/', {
      lon: String(lng),
      lat: String(lat),
    })) as { features?: { properties?: { postcode?: string; city?: string; street?: string; name?: string } }[] };
    const p = data.features?.[0]?.properties ?? {};
    return { postcode: p.postcode, city: p.city, street: p.street ?? p.name };
  } catch {
    return {};
  }
}

function departmentOfPostcode(postcode: string): string {
  if (postcode.startsWith('20')) {
    // Corsica: 200xx/201xx → 2A, 202xx/206xx → 2B (approximation refined by hand).
    return Number(postcode) < 20200 ? '2A' : '2B';
  }
  if (postcode.startsWith('97')) return postcode.slice(0, 3);
  return postcode.slice(0, 2);
}

async function main() {
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx !== -1 ? process.argv[outIdx + 1] : null;
  if (!outPath) throw new Error('--out <path> is required');

  const list: Record<string, string> = JSON.parse(
    readFileSync(join(import.meta.dirname, 'fixtures/cmn-monuments.json'), 'utf-8'),
  );
  const museums: Museum[] = JSON.parse(readFileSync(join(ROOT, 'data/museums.json'), 'utf-8'));
  const existingQids = new Set(museums.map((m) => m.wikidata).filter(Boolean));
  const existingHosts = new Set(
    museums.map((m) => (m.website ? hostname(m.website) : null)).filter(Boolean),
  );
  const existingIds = new Set(museums.map((m) => m.id));

  const resolved: (Partial<Museum> & { cmnUrl: string })[] = [];
  const skippedExisting: string[] = [];
  const problems: string[] = [];

  for (const [url, display] of Object.entries(list)) {
    const match = display.match(/^(.*?)\s*\((\d[0-9AB]?)\)\s*$/);
    const name = (match ? match[1] : display).trim();
    const listedDept = match ? (match[2].length === 1 ? `0${match[2]}` : match[2]) : null;
    const host = hostname(url);

    if (host && existingHosts.has(host)) {
      skippedExisting.push(`${name} — website already in dataset`);
      continue;
    }

    try {
      const candidates = await searchCandidates(name);
      const entities = await fetchEntities(candidates);
      let best: { e: WdEntity; score: number } | null = null;
      for (const e of entities.values()) {
        const coord = coordOf(e);
        const inFrance =
          coord !== null &&
          coord[1] > FRANCE.minLat && coord[1] < FRANCE.maxLat &&
          coord[0] > FRANCE.minLng && coord[0] < FRANCE.maxLng;
        const webMatch = websitesOf(e).some((w) => hostname(w) === host);
        const sim = bestLabelSim(name, e);
        if (!webMatch && !(sim >= 0.6 && inFrance)) continue;
        const score = (webMatch ? 2 : 0) + sim + (inFrance ? 0.5 : 0);
        if (!best || score > best.score) best = { e, score };
      }
      if (!best) {
        problems.push(`${name} — no confident Wikidata match (${candidates.length} candidates)`);
        continue;
      }
      const e = best.e;
      if (existingQids.has(e.id)) {
        skippedExisting.push(`${name} — ${e.id} already in dataset`);
        continue;
      }
      const coord = coordOf(e);
      if (!coord) {
        problems.push(`${name} — matched ${e.id} but it has no coordinates`);
        continue;
      }
      const ban = await banReverse(coord[0], coord[1]);
      await sleep(120);
      if (!ban.postcode) {
        problems.push(`${name} — ${e.id}: BAN reverse gave no postcode`);
        continue;
      }
      const dept = departmentOfPostcode(ban.postcode);
      if (listedDept && dept !== listedDept && !(listedDept === '20' && dept.startsWith('2'))) {
        problems.push(
          `${name} — dept mismatch: list says ${listedDept}, coordinates say ${dept} (${ban.postcode} ${ban.city}) — verify ${e.id}`,
        );
        continue;
      }
      let id = slugify(name);
      while (existingIds.has(id)) id = `${id}-cmn`;
      existingIds.add(id);
      const frwiki = e.sitelinks?.frwiki?.title;
      resolved.push({
        id,
        name,
        coordinates: [Number(coord[0].toFixed(6)), Number(coord[1].toFixed(6))],
        address: streetAddressOf(e) ?? ban.street ?? '',
        postalCode: ban.postcode,
        commune: ban.city ?? '',
        department: dept,
        website: url,
        tags: ['monument'],
        freeAccess: [],
        wikidata: e.id,
        ...(frwiki
          ? { wikipediaFr: `https://fr.wikipedia.org/wiki/${encodeURIComponent(frwiki.replace(/ /g, '_'))}` }
          : {}),
        cmnUrl: url,
      });
      console.log(`${id} → ${e.id} (${ban.postcode} ${ban.city})`);
    } catch (err) {
      problems.push(`${name} — error: ${String(err)}`);
    }
  }

  console.log(
    `\n${resolved.length} resolved, ${skippedExisting.length} already in dataset, ${problems.length} problem(s).`,
  );
  for (const s of skippedExisting) console.log(`  = ${s}`);
  for (const p of problems) console.log(`  ! ${p}`);
  writeFileSync(outPath, `${JSON.stringify(resolved, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
