# Wikidata-Sourced Museum Header Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a real photo behind the `DetailPanel` header for museums whose Wikidata item has a permissively-licensed image, self-hosted and attributed, while leaving every other museum's header exactly as it is today.

**Architecture:** A new enrichment script (`scripts/enrich-images.ts`) reads each museum's `wikidata` QID, resolves its P18 image via the Wikidata + Commons APIs, downloads and re-encodes it, and writes a small `image` object (file path + attribution) into `data/museums.json` — the same "static JSON, refreshed by a repeatable script" pattern `enrich-wikidata.ts` already uses. `DetailPanel` renders that image as a `background-image` with a gradient scrim when present; museums without one render unchanged.

**Tech Stack:** TypeScript (`tsx` runner), `sharp` (already a devDependency) for resize/re-encode, Wikidata + Wikimedia Commons public APIs, Vitest, React + CSS Modules, `vite-plugin-pwa` (Workbox) for offline caching.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-06-museum-header-images-design.md` (approved).
- License allow-list, exact canonical forms to store: `CC0 1.0`, `Public Domain`, `CC BY {version}`, `CC BY-SA {version}` (e.g. `CC BY-SA 4.0`). Anything else is rejected.
- Images: resize to a max 1200px long edge, re-encode as JPEG quality 78, store at `public/images/museums/<museum-id>.jpg`, committed to git (not gitignored, not CI-only).
- `museum.image` is never overwritten by a normal run — only by an explicit `--force` flag (mirrors `enrich-wikidata.ts`).
- `MuseumCard` (the list row) is explicitly out of scope. Only `DetailPanel` changes.
- Museums with no usable image keep today's flat header unchanged — no placeholder graphic, ever.
- Any new UI string must be added to all 10 locales: `en, fr, es, it, de, zh-Hans, zh-Hant, ja, ko, ar` (`tests/locales.test.ts` enforces exact key parity against `en.json`).
- `sharp` is already a devDependency (used by `scripts/generate-icons.ts`) — do not add a new dependency for image processing.

---

### Task 1: Data model — `MuseumImage` type and its validation test

**Files:**
- Modify: `src/lib/types.ts:47-77`
- Modify: `tests/data.test.ts:1-7`, `tests/data.test.ts:88-99`

**Interfaces:**
- Produces: `MuseumImage { file: string; author: string; license: string; sourceUrl: string; wikimediaFile?: string }`, and `Museum.image?: MuseumImage`. Every later task that reads or writes a museum's photo uses exactly this shape.

- [ ] **Step 1: Add the `MuseumImage` type and the `image` field to `Museum`**

In `src/lib/types.ts`, insert a new interface right before `export interface Museum {`:

```ts
/** Detail-page header photo and its attribution. */
export interface MuseumImage {
  /** Path relative to /public, e.g. "images/museums/arc-de-triomphe.jpg". */
  file: string;
  author: string;
  /** Canonical short form, e.g. "CC BY-SA 4.0", "CC0 1.0", "Public Domain". */
  license: string;
  /** Commons file page, or the manually-supplied source when overridden. */
  sourceUrl: string;
  /** "File:Xxx.jpg" — set only when sourced from Wikimedia Commons. */
  wikimediaFile?: string;
}

export interface Museum {
```

And inside `Museum`, change:

```ts
  /** Wikidata item id (e.g. 'Q19675'). */
  wikidata?: string;
  /** French Wikipedia article URL, from the item's frwiki sitelink. */
  wikipediaFr?: string;
  /** Venue-level caveat shown on the detail page (e.g. temporary closure). */
  note?: string;
}
```

to:

```ts
  /** Wikidata item id (e.g. 'Q19675'). */
  wikidata?: string;
  /** French Wikipedia article URL, from the item's frwiki sitelink. */
  wikipediaFr?: string;
  /** Detail-page header photo, sourced from the Wikidata item's image (P18)
   *  or a manual override — see scripts/enrich-images.ts. */
  image?: MuseumImage;
  /** Venue-level caveat shown on the detail page (e.g. temporary closure). */
  note?: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Add the image-metadata validation test**

In `tests/data.test.ts`, change the import block at the top from:

```ts
import { describe, expect, it } from 'vitest';
import museumsJson from '../data/museums.json';
import eventsJson from '../data/events.json';
import type { EventDates, Museum } from '@/lib/types';
```

to:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import museumsJson from '../data/museums.json';
import eventsJson from '../data/events.json';
import type { EventDates, Museum } from '@/lib/types';
```

Then insert a new test right after the `'has well-formed, unique Wikidata links'` test and before `'contains no leftover placeholder values'`:

```ts
      if (m.wikipediaFr) {
        expect(m.wikipediaFr, m.id).toMatch(/^https:\/\/fr\.wikipedia\.org\/wiki\/./);
        // A Wikipedia link without its Wikidata item means enrichment went wrong.
        expect(m.wikidata, m.id).toBeDefined();
      }
    }
  });

  it('has well-formed image metadata for museums that have one', () => {
    const ALLOWED_LICENSE = /^(CC0 1\.0|Public Domain|CC BY(-SA)? \d\.\d)$/;
    for (const m of museums) {
      if (!m.image) continue;
      expect(m.image.file, m.id).toMatch(/^images\/museums\/[a-z0-9-]+\.jpg$/);
      expect(m.image.author.trim(), m.id).not.toBe('');
      expect(m.image.license, m.id).toMatch(ALLOWED_LICENSE);
      expect(m.image.sourceUrl, m.id).toMatch(/^https?:\/\//);
      const onDisk = join(__dirname, '..', 'public', m.image.file);
      expect(existsSync(onDisk), `${m.id}: ${m.image.file} missing under public/`).toBe(true);
    }
  });

  it('contains no leftover placeholder values', () => {
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/data.test.ts`
Expected: PASS. No museum has `image` set yet, so the new test's loop body never executes on this run — that's expected; it starts doing real work once Task 3 populates data.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts tests/data.test.ts
git commit -m "feat: add MuseumImage type for header photo metadata"
```

---

### Task 2: Pure helpers for license/author handling (`scripts/lib/images.ts`)

**Files:**
- Create: `scripts/lib/images.ts`
- Test: `tests/images.test.ts`

**Interfaces:**
- Consumes: nothing (pure string functions).
- Produces: `classifyLicense(raw: string): string | null`, `parseArtist(raw: string): string`, `imagePathFor(museumId: string): string` — Task 3's `scripts/enrich-images.ts` imports and calls all three by these exact names.

- [ ] **Step 1: Write the failing tests**

Create `tests/images.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyLicense, imagePathFor, parseArtist } from '../scripts/lib/images';

describe('classifyLicense', () => {
  it('accepts CC0', () => {
    expect(classifyLicense('CC0 1.0')).toBe('CC0 1.0');
  });

  it('accepts Public Domain wording, case-insensitively', () => {
    expect(classifyLicense('Public domain')).toBe('Public Domain');
    expect(classifyLicense('PD')).toBe('Public Domain');
  });

  it('accepts CC BY with a version number', () => {
    expect(classifyLicense('CC BY 3.0')).toBe('CC BY 3.0');
    expect(classifyLicense('CC BY 4.0')).toBe('CC BY 4.0');
  });

  it('accepts CC BY-SA with a version number', () => {
    expect(classifyLicense('CC BY-SA 4.0')).toBe('CC BY-SA 4.0');
    expect(classifyLicense('CC BY-SA 2.5')).toBe('CC BY-SA 2.5');
  });

  it('rejects non-commercial and no-derivatives licenses', () => {
    expect(classifyLicense('CC BY-NC 4.0')).toBe(null);
    expect(classifyLicense('CC BY-ND 4.0')).toBe(null);
    expect(classifyLicense('CC BY-NC-SA 4.0')).toBe(null);
  });

  it('rejects unrecognized or non-free licenses', () => {
    expect(classifyLicense('All rights reserved')).toBe(null);
    expect(classifyLicense('Fair use')).toBe(null);
  });
});

describe('parseArtist', () => {
  it('strips HTML tags from a linked author', () => {
    expect(parseArtist('<a href="//commons.wikimedia.org/wiki/User:Jane">Jane Doe</a>')).toBe(
      'Jane Doe',
    );
  });

  it('decodes common HTML entities', () => {
    expect(parseArtist('Foo &amp; Bar')).toBe('Foo & Bar');
    expect(parseArtist('D&#39;Artagnan')).toBe("D'Artagnan");
  });

  it('collapses whitespace and trims', () => {
    expect(parseArtist('  Jane   Doe  ')).toBe('Jane Doe');
  });

  it('passes plain text through unchanged', () => {
    expect(parseArtist('Jane Doe')).toBe('Jane Doe');
  });
});

describe('imagePathFor', () => {
  it('builds the public/ relative path from a museum id', () => {
    expect(imagePathFor('arc-de-triomphe')).toBe('images/museums/arc-de-triomphe.jpg');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/images.test.ts`
Expected: FAIL — `Cannot find module '../scripts/lib/images'`.

- [ ] **Step 3: Implement the helpers**

Create `scripts/lib/images.ts`:

```ts
/**
 * Pure helpers for scripts/enrich-images.ts — license classification,
 * Commons metadata cleanup, and the on-disk path convention for downloaded
 * header photos.
 */

/**
 * Canonical form of a license this project is willing to redistribute, or
 * null when the license isn't recognized as one of them. Matches Wikimedia
 * Commons' `extmetadata.LicenseShortName` values (e.g. "CC BY-SA 4.0").
 */
export function classifyLicense(raw: string): string | null {
  const s = raw.trim();
  if (/^cc0/i.test(s)) return 'CC0 1.0';
  if (/public domain/i.test(s) || /^pd$/i.test(s)) return 'Public Domain';
  const bySa = s.match(/^cc[\s-]?by[\s-]?sa[\s-]?(\d\.\d)/i);
  if (bySa) return `CC BY-SA ${bySa[1]}`;
  const by = s.match(/^cc[\s-]?by[\s-]?(\d\.\d)/i);
  if (by) return `CC BY ${by[1]}`;
  return null;
}

/** Commons' Artist field is usually an HTML link — reduce it to plain text. */
export function parseArtist(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Where a museum's downloaded header photo lives, relative to /public. */
export function imagePathFor(museumId: string): string {
  return `images/museums/${museumId}.jpg`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/images.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/images.ts tests/images.test.ts
git commit -m "feat: add license/author parsing helpers for museum images"
```

---

### Task 3: The enrichment script (`scripts/enrich-images.ts`)

**Files:**
- Create: `scripts/enrich-images.ts`

**Interfaces:**
- Consumes: `classifyLicense`, `parseArtist`, `imagePathFor` from `scripts/lib/images.ts` (Task 2); `Museum`, `MuseumImage` from `src/lib/types.ts` (Task 1).
- Produces: writes `museum.image` (shape `MuseumImage`) into `data/museums.json` for processed museums, and the corresponding JPEG under `public/images/museums/`. Task 4's `check-images.ts` and Task 7's UI both read `museum.image` by this exact name.

- [ ] **Step 1: Write the script**

Create `scripts/enrich-images.ts`:

```ts
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
  'free-museums-paris-enrich/1.0 (https://travel-eu.github.io/free-museums-paris/; tomchen.org@gmail.com)';
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

async function downloadAndResize(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
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

      if (!wikimediaFile) {
        skippedNoImage++;
        noImage.push(`${museum.id} — no P18 image claim`);
        continue;
      }

      if (dryRun) {
        console.log(`${museum.id} → would fetch File:${wikimediaFile}`);
        done++;
        continue;
      }

      const image = await resolveFromCommons(museum.id, wikimediaFile, dryRun);
      if (!image) {
        skippedNoLicense++;
        noImage.push(`${museum.id} — File:${wikimediaFile} not under an accepted license`);
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run for real against a small sample**

Run: `npx tsx scripts/enrich-images.ts --limit=5`
Expected: the script fetches up to 5 museums' Wikidata entities, attempts each one's P18 image, and either downloads it (prints `<id> → images/museums/<id>.jpg (<license>)`) or logs why it skipped (no P18 claim, or a license outside the allow-list). This hits the live network — outcomes are data-dependent. If fewer than 2 succeed, re-run with a higher `--limit` (e.g. `--limit=20`) until at least 2 real images are downloaded; real photos are needed for Task 7's visual check.

- [ ] **Step 4: Verify the results on disk and in data**

Run: `git status --short public/images data/museums.json`
Expected: new `.jpg` files under `public/images/museums/`, and `data/museums.json` shows only the processed museums' `image` fields added (no other diff).

Run: `npx vitest run tests/data.test.ts`
Expected: PASS — the "has well-formed image metadata" test now actually exercises the newly-populated entries.

- [ ] **Step 5: Commit**

```bash
git add scripts/enrich-images.ts public/images data/museums.json
git commit -m "feat: add scripts/enrich-images.ts, seed a handful of header photos"
```

---

### Task 4: Reporting script and pipeline wiring (`scripts/check-images.ts`)

**Files:**
- Create: `scripts/check-images.ts`
- Modify: `package.json:11-29`

**Interfaces:**
- Consumes: `Museum` from `src/lib/types.ts`; reads `data/museums.json` directly (no imports from Task 3's script).

- [ ] **Step 1: Write the script**

Create `scripts/check-images.ts`:

```ts
/**
 * Reports museums with no header image — the "no image" list for manual
 * sourcing (pin the result in scripts/enrich-images.ts's OVERRIDES). Always
 * exits 0: a missing image is expected for some museums (no Wikidata item,
 * no P18 claim, or no permissively-licensed photo), not a data-integrity
 * failure.
 *
 * Usage: npx tsx scripts/check-images.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const MUSEUMS_PATH = join(ROOT, 'data/museums.json');

function main() {
  const museums: Museum[] = JSON.parse(readFileSync(MUSEUMS_PATH, 'utf-8'));
  const withImage = museums.filter((m) => m.image);
  const without = museums.filter((m) => !m.image);

  console.log(`${withImage.length}/${museums.length} museums have a header image.`);
  if (without.length) {
    console.log('\nNo image — needs manual sourcing (see scripts/enrich-images.ts OVERRIDES):');
    for (const m of without) console.log(`  ? ${m.id} — ${m.name}`);
  }
}

main();
```

- [ ] **Step 2: Wire it into package.json**

In `package.json`, change:

```json
    "update:wikidata": "tsx scripts/enrich-wikidata.ts",
    "update:hours": "tsx scripts/import-opening-hours.ts",
    "update:all": "npm run update:rules && npm run update:wikidata && tsx scripts/check-wikidata.ts --write && tsx scripts/check-datagouv.ts --write && npm run check:freshness",
    "check:freshness": "tsx scripts/check-freshness.ts",
    "check:wikidata": "tsx scripts/check-wikidata.ts",
    "check:datagouv": "tsx scripts/check-datagouv.ts",
    "check:osm-hours": "tsx scripts/check-osm-hours.ts",
    "check:data": "npm run check:freshness && npm run check:wikidata && npm run check:datagouv",
```

to:

```json
    "update:wikidata": "tsx scripts/enrich-wikidata.ts",
    "update:images": "tsx scripts/enrich-images.ts",
    "update:hours": "tsx scripts/import-opening-hours.ts",
    "update:all": "npm run update:rules && npm run update:wikidata && tsx scripts/check-wikidata.ts --write && npm run update:images && tsx scripts/check-datagouv.ts --write && npm run check:freshness",
    "check:freshness": "tsx scripts/check-freshness.ts",
    "check:wikidata": "tsx scripts/check-wikidata.ts",
    "check:images": "tsx scripts/check-images.ts",
    "check:datagouv": "tsx scripts/check-datagouv.ts",
    "check:osm-hours": "tsx scripts/check-osm-hours.ts",
    "check:data": "npm run check:freshness && npm run check:wikidata && npm run check:images && npm run check:datagouv",
```

- [ ] **Step 3: Run it**

Run: `npx tsx scripts/check-images.ts`
Expected: prints `N/145 museums have a header image.` (N matching however many Task 3 seeded) followed by the "no image" list for the rest. Exit code 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-images.ts package.json
git commit -m "feat: add check-images.ts and wire image enrichment into the update pipeline"
```

---

### Task 5: Offline caching for museum photos (`vite.config.ts`)

**Files:**
- Modify: `vite.config.ts:38-54`

- [ ] **Step 1: Add a runtime-caching entry for museum photos**

`globPatterns` only precaches `js/css/html/svg/png/woff2` — adding `jpg` there would force eager download of every museum photo on first install. Instead, cache them as the visitor browses, the same way the map tiles already are. Change:

```ts
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/free-museums-paris/index.html',
        runtimeCaching: [
          {
            // Vector tiles, glyphs, sprites and styles — capped, offline-friendly.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
```

to:

```ts
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/free-museums-paris/index.html',
        runtimeCaching: [
          {
            // Vector tiles, glyphs, sprites and styles — capped, offline-friendly.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Museum header photos — cached as the visitor browses, not
            // eagerly precached (there can be well over 100 of them).
            urlPattern: /\/images\/museums\/.*\.jpg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'museum-photos',
              expiration: { maxEntries: 200, maxAgeSeconds: 180 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the build accepts the config**

Run: `npm run build`
Expected: builds successfully; the Workbox log line at the end lists `museum-photos` alongside `openfreemap-tiles` (or otherwise shows no config error). Clean up afterward: `rm -rf dist`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat: cache museum header photos for offline use"
```

---

### Task 6: Photo credit string in all 10 locales

**Files:**
- Modify: `src/locales/en.json`, `fr.json`, `es.json`, `it.json`, `de.json`, `zh-Hans.json`, `zh-Hant.json`, `ja.json`, `ko.json`, `ar.json` (each in the `museum` block, right after `frenchName`)

**Interfaces:**
- Produces: i18n key `museum.photoCredit` with interpolation tokens `{{author}}` and `{{license}}` in every locale. Task 7's `DetailPanel.tsx` calls `t('museum.photoCredit', { author, license })`.

- [ ] **Step 1: Add the key to every locale file**

`src/locales/en.json` — change:

```json
    "frenchName": "French name: ",
```

to:

```json
    "frenchName": "French name: ",
    "photoCredit": "Photo: {{author}} · {{license}}",
```

`src/locales/fr.json` — change:

```json
    "frenchName": "Nom français : ",
```

to:

```json
    "frenchName": "Nom français : ",
    "photoCredit": "Photo : {{author}} · {{license}}",
```

`src/locales/es.json` — change:

```json
    "frenchName": "Nombre en francés: ",
```

to:

```json
    "frenchName": "Nombre en francés: ",
    "photoCredit": "Foto: {{author}} · {{license}}",
```

`src/locales/it.json` — change:

```json
    "frenchName": "Nome francese: ",
```

to:

```json
    "frenchName": "Nome francese: ",
    "photoCredit": "Foto: {{author}} · {{license}}",
```

`src/locales/de.json` — change:

```json
    "frenchName": "Französischer Name: ",
```

to:

```json
    "frenchName": "Französischer Name: ",
    "photoCredit": "Foto: {{author}} · {{license}}",
```

`src/locales/zh-Hans.json` — change:

```json
    "frenchName": "法语名称：",
```

to:

```json
    "frenchName": "法语名称：",
    "photoCredit": "图片：{{author}} · {{license}}",
```

`src/locales/zh-Hant.json` — change:

```json
    "frenchName": "法文名稱：",
```

to:

```json
    "frenchName": "法文名稱：",
    "photoCredit": "圖片：{{author}} · {{license}}",
```

`src/locales/ja.json` — change:

```json
    "frenchName": "フランス語名：",
```

to:

```json
    "frenchName": "フランス語名：",
    "photoCredit": "写真：{{author}}・{{license}}",
```

`src/locales/ko.json` — change:

```json
    "frenchName": "프랑스어 이름: ",
```

to:

```json
    "frenchName": "프랑스어 이름: ",
    "photoCredit": "사진: {{author}} · {{license}}",
```

`src/locales/ar.json` — change:

```json
    "frenchName": "الاسم الفرنسي: ",
```

to:

```json
    "frenchName": "الاسم الفرنسي: ",
    "photoCredit": "الصورة: {{author}} · {{license}}",
```

- [ ] **Step 2: Run the locale test suite**

Run: `npx vitest run tests/locales.test.ts`
Expected: PASS for all 10 locales — key-parity and interpolation-token checks both cover `photoCredit` automatically now that it exists in `en.json`.

- [ ] **Step 3: Commit**

```bash
git add src/locales/*.json
git commit -m "feat: add museum.photoCredit string to all 10 locales"
```

---

### Task 7: Render the photo header in `DetailPanel`

**Files:**
- Modify: `src/components/DetailPanel.tsx:34-44`, `:102-121`
- Modify: `src/components/DetailPanel.module.css:32-39`

**Interfaces:**
- Consumes: `museum.image` (`MuseumImage | undefined`, Task 1), `t('museum.photoCredit', { author, license })` (Task 6).

- [ ] **Step 1: Derive the photo URL and update the header JSX**

In `src/components/DetailPanel.tsx`, change:

```tsx
  const entry = content[museum.id];
  const localized = entry?.name;
  const description = entry?.description;
  const categories = deriveCategories(museum);
```

to:

```tsx
  const entry = content[museum.id];
  const localized = entry?.name;
  const description = entry?.description;
  const categories = deriveCategories(museum);
  const photoUrl = museum.image
    ? `${import.meta.env.BASE_URL}${museum.image.file}`
    : undefined;
```

Then change the header block:

```tsx
      <header
        className={styles.header}
        style={{ borderInlineStartColor: CATEGORY_COLORS[categories[0]] }}
      >
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.name}>{localized ?? museum.name}</h2>
        {showFrench && (
          <p className={styles.frenchName}>
            <span className={styles.frenchLabel}>{t('museum.frenchName')}</span>
            {museum.name}
          </p>
        )}
        <div className={styles.badges}>
          {categories.map((category) => (
            <CategoryBadge key={category} category={category} />
          ))}
          {freeToday && <span className={styles.today}>{t('museum.todayFree')}</span>}
        </div>
        {museum.note && <p className={styles.note}>{notes[museum.note] ?? museum.note}</p>}
      </header>
```

to:

```tsx
      <header
        className={photoUrl ? `${styles.header} ${styles.headerPhoto}` : styles.header}
        style={
          photoUrl
            ? { backgroundImage: `url(${photoUrl})` }
            : { borderInlineStartColor: CATEGORY_COLORS[categories[0]] }
        }
      >
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.name}>{localized ?? museum.name}</h2>
        {showFrench && (
          <p className={styles.frenchName}>
            <span className={styles.frenchLabel}>{t('museum.frenchName')}</span>
            {museum.name}
          </p>
        )}
        <div className={styles.badges}>
          {categories.map((category) => (
            <CategoryBadge key={category} category={category} />
          ))}
          {freeToday && <span className={styles.today}>{t('museum.todayFree')}</span>}
        </div>
        {museum.note && <p className={styles.note}>{notes[museum.note] ?? museum.note}</p>}
        {museum.image && (
          <a
            className={styles.credit}
            href={museum.image.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('museum.photoCredit', {
              author: museum.image.author,
              license: museum.image.license,
            })}
          </a>
        )}
      </header>
```

- [ ] **Step 2: Add the photo-header styles**

In `src/components/DetailPanel.module.css`, change:

```css
/* Gallery wall-label: category-colored edge, small-caps eyebrow. */
.header {
  border-inline-start: 4px solid var(--color-accent);
  padding-inline-start: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
```

to:

```css
/* Gallery wall-label: category-colored edge, small-caps eyebrow. */
.header {
  border-inline-start: 4px solid var(--color-accent);
  padding-inline-start: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

/* Photo variant: same content, laid over a Wikidata-sourced header photo. */
.headerPhoto {
  border-inline-start: none;
  padding: 1rem 0.8rem 0.6rem;
  min-block-size: 180px;
  justify-content: flex-end;
  background-size: cover;
  background-position: center;
  border-radius: var(--radius);
  position: relative;
  color: #fff;
}

.headerPhoto::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0.1) 60%);
  border-radius: inherit;
}

.headerPhoto > * {
  position: relative;
}

.headerPhoto .eyebrow,
.headerPhoto .frenchName {
  color: rgb(255 255 255 / 0.85);
}

.credit {
  align-self: flex-end;
  font-size: 0.68rem;
  color: rgb(255 255 255 / 0.75);
  text-decoration: none;
  margin-block-start: 0.3rem;
}

.credit:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: PASS, no regressions.

- [ ] **Step 5: Visual check — one museum with a photo, one without**

Start the dev server (`npm run dev`, note the port it prints), then use whatever browser-automation tool is available (e.g. the `agent-browser` or `chromium-cli` skill) to:

1. Open the app, click into one of the museums Task 3 seeded with a real `image` (check `data/museums.json` for an `id` with an `image` field) and screenshot the detail panel.
   Expected: the header shows the photo with a dark-to-transparent gradient behind the name/badges, white text is legible, and a small "Photo: …" credit line linking to the Commons file sits in the header's bottom-right.
2. Open a museum with no `image` field and screenshot the detail panel.
   Expected: header looks exactly as it did before this plan — flat background, colored left border, no credit line.
3. Repeat both screenshots with the OS/browser color scheme set to dark (e.g. `agent-browser --color-scheme dark`, or emulate dark via `prefers-color-scheme` in whatever tool is available).
   Expected: same as steps 1–2 — the photo header's white text/scrim look right regardless of theme (they're hardcoded white-on-photo, not theme tokens), and the no-image header follows the app's existing dark-mode colors unchanged.
4. Check the browser console for errors on every page opened above.
   Expected: none.

Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailPanel.tsx src/components/DetailPanel.module.css
git commit -m "feat: render Wikidata-sourced photo in the museum detail header"
```

---

## After this plan

`data/museums.json` will have real `image` entries only for the handful of museums Task 3 seeded (bounded by `--limit`, chosen by live network/license luck) — not all 142 eligible museums. Running `npm run update:images` (no `--limit`) does the full pass; `npm run check:images` lists what's left for manual sourcing via `OVERRIDES` in `scripts/enrich-images.ts`, per the spec.
