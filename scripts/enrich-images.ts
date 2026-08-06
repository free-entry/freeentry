/**
 * Downloads a self-hosted header photo for each museum from its Wikidata
 * item's image (P18), when one exists under a license we're willing to
 * redistribute. Repeatable and non-destructive: a museum that already has
 * `image` is skipped unless --force is passed, so both automated picks and
 * hand-pinned OVERRIDES survive re-runs.
 *
 * Usage: npx tsx scripts/enrich-images.ts [--dry-run] [--force] [--limit=N]
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Museum, MuseumImage } from '../src/lib/types';
import { classifyLicense, imagePathFor, parseArtist } from './lib/images';

const ROOT = join(import.meta.dirname, '..');
const MUSEUMS_PATH = join(ROOT, 'data/museums.json');
const PUBLIC_DIR = join(ROOT, 'public');
const WD_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const UA =
  'free-museums-france-enrich/1.0 (https://travel-eu.github.io/free-museums-france/; tomchen.org@gmail.com)';
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 78;

type ImageOverride =
  | { wikimediaFile: string }
  | { url: string; author: string; license: string; sourceUrl: string };

/**
 * Hand-picked images for museums the automated pass can't cover — filled in
 * from scripts/check-images.ts's "no image" report. Pins survive future
 * runs (see the `museum.image` skip-if-set check in main()).
 */
const OVERRIDES: Record<string, ImageOverride> = {};

interface Claim {
  mainsnak?: { datavalue?: { value?: unknown } };
}
interface WdEntity {
  id: string;
  claims?: Record<string, Claim[]>;
}

async function fetchEntities(ids: string[]): Promise<Map<string, WdEntity>> {
  const map = new Map<string, WdEntity>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `${WD_API}?${new URLSearchParams({
      format: 'json',
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'claims',
    })}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const data = (await res.json()) as { entities?: Record<string, WdEntity> };
    for (const [id, entity] of Object.entries(data.entities ?? {})) map.set(id, entity);
    await new Promise((r) => setTimeout(r, 100));
  }
  return map;
}

function imageFilenameOf(entity: WdEntity): string | null {
  const claim = entity.claims?.P18?.[0];
  const v = claim?.mainsnak?.datavalue?.value;
  return typeof v === 'string' ? v : null;
}

interface CommonsImageInfo {
  url: string;
  extmetadata?: {
    LicenseShortName?: { value: string };
    Artist?: { value: string };
  };
}

async function fetchImageInfo(filename: string): Promise<CommonsImageInfo | null> {
  const url = `${COMMONS_API}?${new URLSearchParams({
    format: 'json',
    action: 'query',
    titles: `File:${filename}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: CommonsImageInfo[] }> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.imageinfo?.[0] ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Commons politeness: pace requests and back off hard on 429. */
const DOWNLOAD_PACE_MS = 1500;

/**
 * Fallback for items without a P18 claim: the French Wikipedia article's lead
 * (infobox) image, resolved through the same Commons license gate.
 */
async function frwikiLeadImage(wikipediaFrUrl: string): Promise<string | null> {
  const title = decodeURIComponent(wikipediaFrUrl.split('/wiki/')[1] ?? '');
  if (!title) return null;
  const url = `https://fr.wikipedia.org/w/api.php?${new URLSearchParams({
    format: 'json',
    action: 'query',
    titles: title,
    prop: 'pageimages',
    piprop: 'name',
    redirects: '1',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { pageimage?: string }> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.pageimage ?? null;
}

async function downloadAndResize(url: string, destPath: string): Promise<void> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(DOWNLOAD_PACE_MS);
    res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status !== 429) break;
    const wait = 30_000 * 2 ** attempt;
    console.log(`  ~ 429 from Commons, backing off ${wait / 1000}s…`);
    await sleep(wait);
  }
  if (!res || !res.ok) throw new Error(`${res?.status} ${res?.statusText} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await sharp(buffer)
    .resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(destPath);
}

async function resolveFromCommons(
  museumId: string,
  wikimediaFile: string,
  dryRun: boolean,
): Promise<MuseumImage | null> {
  const info = await fetchImageInfo(wikimediaFile);
  if (!info) return null;
  const rawLicense = info.extmetadata?.LicenseShortName?.value;
  const license = rawLicense ? classifyLicense(rawLicense) : null;
  if (!license) return null;
  const author = parseArtist(info.extmetadata?.Artist?.value ?? 'Unknown');
  const destRelative = imagePathFor(museumId);
  if (!dryRun) await downloadAndResize(info.url, join(PUBLIC_DIR, destRelative));
  return {
    file: destRelative,
    author,
    license,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(
      wikimediaFile.replace(/ /g, '_'),
    )}`,
    wikimediaFile: `File:${wikimediaFile}`,
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

  if (!dryRun) mkdirSync(join(PUBLIC_DIR, 'images/museums'), { recursive: true });

  const museums: Museum[] = JSON.parse(readFileSync(MUSEUMS_PATH, 'utf-8'));
  let candidates = museums.filter((m) => !m.image || force);
  if (Number.isFinite(limit)) candidates = candidates.slice(0, limit);

  const needQid = candidates.filter((m) => m.wikidata && !(m.id in OVERRIDES));
  const entities = await fetchEntities(needQid.map((m) => m.wikidata as string));

  let done = 0;
  let skippedNoLicense = 0;
  let skippedNoImage = 0;
  const noImage: string[] = [];

  for (const museum of candidates) {
    const override = OVERRIDES[museum.id];
    try {
      if (override && 'url' in override) {
        const destRelative = imagePathFor(museum.id);
        if (!dryRun) await downloadAndResize(override.url, join(PUBLIC_DIR, destRelative));
        museum.image = {
          file: destRelative,
          author: override.author,
          license: override.license,
          sourceUrl: override.sourceUrl,
        };
        console.log(`${museum.id} ← manual override`);
        done++;
        continue;
      }

      const wikimediaFile =
        override && 'wikimediaFile' in override
          ? override.wikimediaFile.replace(/^File:/, '')
          : museum.wikidata
            ? imageFilenameOf(entities.get(museum.wikidata) ?? { id: '' })
            : null;

      let sourceFile = wikimediaFile;
      let via = 'P18';
      if (!sourceFile && museum.wikipediaFr) {
        sourceFile = await frwikiLeadImage(museum.wikipediaFr);
        via = 'frwiki infobox';
      }
      if (!sourceFile) {
        skippedNoImage++;
        noImage.push(`${museum.id} — no P18 image claim, no frwiki lead image`);
        continue;
      }

      if (dryRun) {
        console.log(`${museum.id} → would fetch File:${sourceFile} (${via})`);
        done++;
        continue;
      }

      const image = await resolveFromCommons(museum.id, sourceFile, dryRun);
      if (!image) {
        skippedNoLicense++;
        noImage.push(`${museum.id} — File:${sourceFile} not under an accepted license`);
        continue;
      }
      museum.image = image;
      console.log(`${museum.id} → ${image.file} (${image.license})`);
      done++;
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      noImage.push(`${museum.id} — error: ${(err as Error).message}`);
    }
  }

  console.log(
    `\n${done} processed, ${skippedNoLicense} skipped (license), ${skippedNoImage} skipped (no P18).`,
  );
  if (noImage.length) {
    console.log('\nNo image — needs manual sourcing:');
    for (const line of noImage) console.log(`  ? ${line}`);
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
