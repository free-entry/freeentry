# France Regional Cities Free-Museums Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the structural gap in `data/fr` — zero museums outside Île-de-France — by researching, verifying and adding free-admission museums across French regional cities (Strasbourg, Nancy, Toulouse, Lyon, Marseille, Rouen, Colmar, Mulhouse, and every other city with a verifiable recurring free scheme), via a `scripts/fixtures/fr/city-schemes.json` list + `scripts/sources/fr/build-fr-cities.ts` resolver modeled on the BE pipeline.

**Architecture:** Same three-stage shape as Italy/Belgium: (1) a hand-verified fixture recording each city's free scheme with per-scheme source URL + quote, (2) an incremental resolver that pools fixture venues, establishes Wikidata identity, geocodes with BAN, derives department/arrondissement from postal codes, and merges into `data/fr/museums.json`, (3) enrichment passes (museofile ids, Commons photos, 10-locale content) reusing the existing country-generic scripts.

**Tech Stack:** tsx scripts, Wikidata API, BAN (`api-adresse.data.gouv.fr`), existing `update:wikidata` / `check:datagouv --write` / `update:images` pipelines, vitest data tests.

## Global Constraints

- Every `freeAccess` rule carries `source.url` + `source.checkedAt: "2026-08-07"` — only for pages actually read during research. Never mark verified what wasn't read (docs/DATA-UPDATE.md).
- Rule kinds allowed by tests: `always | nth-weekday | weekly | event | annual-date`; audiences: `everyone | under-26-eu | under-18 | residents` (tests/data.test.ts:23-24).
- Resident-only schemes must carry `audience: "residents"` and never gain a general-audience rule without a source (DATA-UPDATE.md §7 principle).
- Prices/nuances go in `note` fields, never a structured admission field (memory: prices-stay-in-notes).
- New venues need: French canonical name (accents on capitals), descriptions in all 10 locales, localized `name` in the 9 non-French locales (DATA-UPDATE.md step 3).
- **Translations and translation review run on Opus/Sonnet subagents with explicit `model:` — never on Fable** (global CLAUDE.md, non-negotiable).
- `data/fr/museums.json` stays sorted by `name` with `localeCompare(…, 'fr')`; ids match `/^[a-z0-9]+(-[a-z0-9]+)*$/` and are unique; coordinates inside bbox lat 41.2–51.2, lng −5.3–9.7 (metropolitan only — no overseas venues).
- Department = postal prefix (2 digits; `20xxx` → `2A`/`2B`); `arrondissement` only valid for 75/69/13 (max 20/9/16); required only for 75.
- Journées du patrimoine / Nuit des musées are modeled as events in `data/fr/events.json`, not per-venue rules — the JEP openagenda lists one-weekend openings, not recurring free admission; it is NOT a venue source for this plan.

---

### Task 1: Research fixture — verify city schemes nationwide

**Files:**
- Create: `scripts/fixtures/fr/city-schemes.json`

**Interfaces:**
- Produces: fixture consumed by Task 2. Shape:

```jsonc
{
  "meta": { "collectedAt": "2026-08-07", "sources": { "<schemeId>": ["url", …] }, "notes": ["…"] },
  "schemes": [
    {
      "id": "strasbourg-first-sunday",          // kebab, unique
      "city": "Strasbourg",                      // commune for all venues unless venue overrides
      "operator": "Musées de la Ville de Strasbourg",
      "kind": "firstSunday",                     // firstSunday | alwaysFree | weekly | firstSundayMonths
      "months": null,                            // int[] for firstSundayMonths, else null
      "weekday": null,                           // for weekly
      "audience": "everyone",                    // everyone | residents | under-18 | under-26-eu
      "note": null,                              // rule-level nuance (permanent collections only, etc.)
      "sourceUrl": "https://…",                  // page actually read
      "quote": "exact admission sentence from the page",
      "venues": [
        { "name": "Musée Alsacien", "address": "23-25 quai Saint-Nicolas, 67000 Strasbourg", "url": "https://…", "city": null, "tags": null, "note": null }
      ]
    }
  ]
}
```

- [ ] **Step 1: Fan out 5 parallel research agents by region** (general-purpose agents; research may run on the session model — only *translation* is model-restricted). Regions: Grand Est; Hauts-de-France + Normandie; Ouest + Centre-Val de Loire; Nouvelle-Aquitaine + Occitanie; Auvergne-Rhône-Alpes + PACA + Bourgogne-Franche-Comté + Corse. Each agent must, per city: find whether municipal / métropole / departmental / national museums have a *recurring* free-admission scheme (always free, first Sunday, monthly, resident-only…); read the OFFICIAL page (city museums portal or venue tarifs page); return per scheme: kind, months, audience, exact quote, source URL, and the venue list (name + street address + venue URL). Also return explicit negatives ("Lyon municipal museums: no free first Sunday — checked <url>") so nothing is re-chased.
- [ ] **Step 2: Spot-check majors myself** — WebFetch the claimed source pages for at least Strasbourg, Marseille, Rouen, Toulouse, Bordeaux; confirm the quotes appear.
- [ ] **Step 3: Assemble `scripts/fixtures/fr/city-schemes.json`** from agent output, dropping any scheme without a verifiable quote+URL. Record negatives and oddities in `meta.notes`.
- [ ] **Step 4: Commit** — `git add scripts/fixtures/fr/city-schemes.json && git commit -m "data: fr city free-scheme fixture (researched + verified)"`

### Task 2: Resolver script `build-fr-cities.ts`

**Files:**
- Create: `scripts/sources/fr/build-fr-cities.ts` (model: `scripts/sources/be/build-be.ts`)
- Modify: `docs/DATA-UPDATE.md` (add the command row)

**Interfaces:**
- Consumes: fixture from Task 1.
- Produces: merged `data/fr/museums.json` entries: `{ id, name, coordinates:[lng,lat], address, postalCode, commune, department, arrondissement?, website?, tags, freeAccess, wikidata?, wikipedia?, note? }`.

Key differences from `build-be.ts`, all else identical (candidate search fr/en labels + frwiki full-text, sim ≥ 0.55, bbox gate, QID dedupe, incremental skip of already-resolved names):

```ts
const FR = { minLat: 41.2, maxLat: 51.2, minLng: -5.3, maxLng: 9.7 };
const TODAY = '2026-08-07';

// BAN, not photon — the project's canonical third opinion (DATA-UPDATE.md)
async function banSearch(address: string): Promise<{ coords: [number, number]; postcode: string } | null> {
  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const f = (await res.json()).features?.[0];
  const coords = f?.geometry?.coordinates, pc = f?.properties?.postcode;
  return coords && /^\d{5}$/.test(pc ?? '') ? { coords: [+coords[0].toFixed(6), +coords[1].toFixed(6)], postcode: pc } : null;
}

function departmentOf(postal: string, lat: number): string | null {
  if (!/^\d{5}$/.test(postal)) return null;
  if (postal.startsWith('20')) return lat < 42.0 ? '2A' : '2B'; // Corsica split ≈ 42°N
  if (postal.startsWith('97')) return null;                     // overseas: out of bbox, reject
  return postal.slice(0, 2);
}

function arrondissementOf(postal: string, dept: string): number | undefined {
  if (dept === '75' && /^750/.test(postal)) return Number(postal.slice(3));
  if (dept === '69' && /^6900[1-9]$/.test(postal)) return Number(postal.slice(4));
  if (dept === '13' && /^130(0[1-9]|1[0-6])$/.test(postal)) return Number(postal.slice(3));
  return undefined;
}

// rulesFor(): firstSunday → {kind:'nth-weekday', nth:1, weekday:'sunday'};
// firstSundayMonths → same + months; alwaysFree → {kind:'always'};
// weekly → {kind:'weekly', weekday}; audience !== 'everyone' copied onto the rule;
// scheme.note → rule.note; source = { url: scheme.sourceUrl, checkedAt: TODAY }.
```

Dedupe guard against the existing 219: skip when the resolved QID already exists in `data/fr/museums.json` OR when `normalize(name)+commune` matches an existing entry (CMN monuments may reappear in city lists). Log skips.

- [ ] **Step 1: Write the resolver** (adapt build-be.ts; BAN + department/arrondissement logic above; sort by `name` localeCompare `'fr'`).
- [ ] **Step 2: Dry-run on one scheme** — `npx tsx scripts/sources/fr/build-fr-cities.ts --limit=5`, inspect output entries by hand.
- [ ] **Step 3: Run `npm test`** — expect PASS (bbox, departments, postal prefixes, rule shapes all enforced by tests/data.test.ts).
- [ ] **Step 4: Commit** — `git commit -m "feat: fr city-schemes resolver (build-fr-cities)"`

### Task 3: Full resolve + manual fixes

**Files:**
- Modify: `data/fr/museums.json`, `data/fr/aliases.json` (if register aliases needed)

- [ ] **Step 1: Full run** `npx tsx scripts/sources/fr/build-fr-cities.ts`; triage every `unresolved` line: fix by adding `address` to the fixture (BAN fallback), correcting names, or hand-writing the entry with coordinates from the venue's official page.
- [ ] **Step 2: Identity cross-checks** — `npm run update:wikidata` (QIDs for stragglers), `npx tsx scripts/check-wikidata.ts` (coordinate disagreement > 0.6 km → arbitrate with BAN), `npm run check:datagouv -- --write` (museofile ids).
- [ ] **Step 3: `npm test`** — bump `MIN_VENUES.fr` in tests/data.test.ts to reflect the new floor (final count − small margin).
- [ ] **Step 4: Commit** — `git commit -m "data: France regional cities — <N> venues across <M> cities"`

### Task 4: Photos

**Files:**
- Modify: `data/fr/museums.json` (image blocks), Create: `public/images/museums/*.jpg`

- [ ] **Step 1: `npm run update:images`** (Commons via QID; license allowlist enforced by tests).
- [ ] **Step 2: `npm run check:images` + `npm test`**; drop image blocks that fail license/dimension checks.
- [ ] **Step 3: Commit** — `git commit -m "data: photos for fr regional venues"`

### Task 5: 10-locale content (Opus/Sonnet only)

**Files:**
- Modify: `data/fr/i18n/museums.fr.json` (description only) and `museums.{en,de,es,it,ja,ko,ar,zh-Hans,zh-Hant}.json` (name + description)

- [ ] **Step 1: French canonical descriptions** — one Opus/Sonnet agent (`model: 'opus'` or `'sonnet'`, explicit) writes fr descriptions for all new venues, style-matched to existing entries (2–3 sentences: what it is, why notable, collection highlights).
- [ ] **Step 2: Translation fan-out** — per-locale Opus/Sonnet agents translate name+description, each given 3–4 existing entries of that locale as style reference. Batch ≤ 40 venues per agent call.
- [ ] **Step 3: Independent review pass** — a *different* Opus/Sonnet agent per locale reviews name accuracy (established exonyms vs transliteration) and description fidelity; apply fixes.
- [ ] **Step 4: `npm test` + spot-check JSON key parity** (every new id present in all 10 files).
- [ ] **Step 5: Commit** — `git commit -m "data: 10-locale content for fr regional venues"`

### Task 6: Finish

- [ ] **Step 1:** `npm run check:freshness && npm test && npm run build` — all green.
- [ ] **Step 2:** Update `docs/DATA-UPDATE.md`: add build-fr-cities row + a France-cities yearly re-verification step (re-read each scheme's source page, bump checkedAt, diff venue lists).
- [ ] **Step 3:** Final commit + summary to user: venues added per city, schemes verified with sources, anything that could NOT be verified stated plainly.

## Self-Review

- Spec coverage: research breadth (✓ Task 1 five-region sweep incl. Colmar/Mulhouse-class towns), verification (✓ quotes + spot-checks), fixture+resolver per IT/BE model (✓ Tasks 1–2), JEP question (✓ Global Constraints — events, not venue source), full content treatment (✓ Tasks 4–5), tests/docs (✓ Tasks 2–6).
- Placeholders: none — resolver deltas are spelled out; the rest reuses existing commands by exact name.
- Type consistency: fixture `kind` values ↔ `rulesFor()` mapping ↔ test-allowed rule kinds checked.
