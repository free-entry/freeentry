# Free Museums Paris & Île-de-France Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the static map PWA described in
`docs/superpowers/specs/2026-08-06-free-museums-paris-design.md`, including its curated
dataset, 10-locale i18n, update script, CI and deployment docs.

**Architecture:** Fully static Vite + React SPA; in-repo JSON dataset with rule-based
free-access model; pure-logic libs (rules/filters/URL state) developed TDD; MapLibre map
+ list as two views over one filtered set; build-time prerender for SEO; manual scraper
script keeps parisjetaime-sourced rules fresh.

**Tech Stack:** Vite 7, React 18, TypeScript strict, MapLibre GL JS 5 + OpenFreeMap
`liberty`, vite-plugin-pwa (Workbox), i18next + react-i18next, react-router 7 (library
mode), Vitest, cheerio (scraper), tsx (scripts), sharp (icon generation).

## Global Constraints

- All README/code/comments/commit messages in **English**; conversation with user in Chinese.
- License **MIT**; repo will be `travel-eu/free-museums-paris`; site base path `/free-museums-paris/`.
- Locales: `en, fr, es, it, de, zh-Hans, zh-Hant, ja, ko, ar` — `ar` fully RTL.
- No backend, no API keys, no paid services. Tiles: OpenFreeMap `https://tiles.openfreemap.org/styles/liberty`.
- Dataset rules must each carry `source: { url, checkedAt }`.
- TypeScript `strict: true`; no `any` in `src/lib` or data types.
- No date libraries — native `Date` + `Intl` only.
- Data JSON lives in `data/`; UI strings in `src/locales/`.

## Execution mode note

Executed inline by the lead session (ultracode): pure-logic tasks TDD inline; data
curation (Task 5), museum descriptions (Task 13) and locale translation (Task 14) are
dispatched as Workflow fan-outs with adversarial verification; final review is a
multi-agent review workflow. Task order below is dependency order; independent tasks may
run concurrently.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`,
  `src/main.tsx`, `src/App.tsx`, `src/styles/global.css`, `LICENSE`
- Test: `npm run test` (empty pass), `npm run build` succeeds, `npm run dev` serves.

**Interfaces:**
- Produces: npm scripts `dev` / `build` (`tsc -b && vite build && tsx scripts/prerender.ts`
  — prerender added Task 16, until then plain build) / `preview` / `test` (`vitest run`) /
  `update-data` / `icons`. Vite `base: '/free-museums-paris/'` in all modes.

**Steps:**
- [ ] `npm create vite` equivalent by hand: package.json with pinned deps (react, react-dom,
      react-router, maplibre-gl, i18next, react-i18next, i18next-browser-languagedetector;
      dev: typescript, vite, @vitejs/plugin-react, vitest, @types/react, @types/react-dom,
      vite-plugin-pwa, cheerio, tsx, sharp, jsdom).
- [ ] `vite.config.ts`: base `/free-museums-paris/`, react plugin, vitest config (environment
      `node`, `tests/**/*.test.ts`), pwa plugin added in Task 15.
- [ ] tsconfig strict, bundler resolution, path alias `@/` → `src/`.
- [ ] Minimal App shell rendering "Free Museums" heading; global.css with CSS custom
      properties (light/dark via `prefers-color-scheme`) and `box-sizing` reset.
- [ ] Verify: `npm run build` + `npm run test` pass. Commit.

### Task 2: Raw source acquisition

**Files:**
- Create: `scripts/fixtures/datagouv-museums.json` (verbatim download),
  `scripts/fixtures/parisjetaime.html` (verbatim download),
  `scripts/fetch-sources.sh` (curl commands used, for reproducibility)

**Interfaces:**
- Produces: fixtures used by Task 4 (scraper tests) and Task 5 (curation input).
- data.gouv JSON resource: `https://www.data.gouv.fr/api/1/datasets/r/6c1502c9-5080-4138-a26f-cc2168042868`
- Article: `https://parisjetaime.com/article/les-musees-et-monuments-gratuits-a-paris-a961`

**Steps:**
- [ ] Download both, inspect field names/structure of the data.gouv JSON, note them in a
      comment header inside `scripts/fetch-sources.sh`. Inspect article HTML section
      structure (category headings, museum cards, links) — record CSS selectors observed.
- [ ] Commit fixtures (they are small; the HTML fixture is the scraper's contract test).

### Task 3: Data types + freeRules lib (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/freeRules.ts`, `src/lib/categories.ts`
- Test: `tests/freeRules.test.ts`, `tests/categories.test.ts`

**Interfaces (produces — exact):**

```ts
// types.ts
export type Department = '75'|'77'|'78'|'91'|'92'|'93'|'94'|'95';
export type Weekday = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday';
export type EventKey = 'museum-night'|'heritage-days';
export type Audience = 'everyone'|'under-26-eu'|'under-18';
export interface RuleSource { url: string; checkedAt: string }
export interface FreeRule {
  kind: 'always'|'nth-weekday'|'event'|'annual-date';
  nth?: 1; weekday?: Weekday; months?: number[];
  event?: EventKey; date?: string;             // 'MM-DD'
  evening?: boolean; audience?: Audience;
  reservationRequired?: boolean; reservationUrl?: string;
  note?: string; source: RuleSource;
}
export interface Museum {
  id: string; name: string; coordinates: [number, number];
  address: string; postalCode: string; commune: string;
  arrondissement?: number; department: Department;
  website?: string; phone?: string; openingHours?: string;
  tags: string[]; freeAccess: FreeRule[]; parisjetaimeUrl?: string;
}
export interface EventDates {                   // data/events.json shape
  [k in EventKey]: { [year: string]: string[] } & { estimatedRule?: string };
}
// freeRules.ts
export interface RuleContext { events: EventDates; under26: boolean }
export interface EventDateInfo { dates: string[]; estimated: boolean }
export function nthWeekdayOfMonth(year: number, month: number, nth: number, weekday: Weekday): string; // 'YYYY-MM-DD'
export function eventDatesForYear(events: EventDates, event: EventKey, year: number): EventDateInfo;
  // confirmed from JSON, else estimated: museum-night = 3rd Saturday of May;
  // heritage-days = 3rd Saturday + following Sunday of September
export function ruleActiveOn(rule: FreeRule, date: string, ctx: RuleContext): boolean;
  // audience!=='everyone' rules only active when ctx.under26 (for 'under-26-eu'/'under-18')
export function isFreeOn(museum: Museum, date: string, ctx: RuleContext): boolean;
export function nextFreeDate(museum: Museum, from: string, ctx: RuleContext): { date: string; rule: FreeRule; estimated: boolean } | null;
  // scans day by day from `from` (inclusive) up to 730 days
// categories.ts
export type Category = 'always'|'first-sunday'|'first-sunday-booking'|'first-sunday-low-season'
  |'first-saturday'|'nocturne'|'special-days'|'under-26-only'|'none';
export function deriveCategory(museum: Museum): Category;  // precedence per spec §4.2
export const CATEGORY_ORDER: Category[];
export const CATEGORY_COLORS: Record<Category, string>;
```

**Pinned test cases (write first, verify failing, implement, verify passing, commit):**
- `nthWeekdayOfMonth(2026,9,1,'sunday') === '2026-09-06'`; `(2026,8,…) === '2026-08-02'`;
  `(2026,11,…) === '2026-11-01'` (day 1 is the weekday); `(2026,10,1,'saturday') === '2026-10-03'`.
- 1st-Sunday rule with `months:[11,12,1,2,3]`: active `2026-11-01`, inactive `2026-10-04`.
- 1st-Saturday rule `months:[10,11,12,1,2,3,4,5,6]`: active `2026-10-03`, inactive `2026-07-04`.
- annual-date `07-14`: active `2026-07-14` only.
- event museum-night, events.json has `2026: ['2026-05-16']` → active + not estimated;
  year 2027 absent → `eventDatesForYear` returns `['2027-05-15']` estimated:true;
  heritage-days 2027 estimated → `['2027-09-18','2027-09-19']`.
- audience `under-26-eu` inactive with `under26:false`, active with true.
- `nextFreeDate` for 1st-Sunday museum from `2026-08-06` → `2026-09-06`; from `2026-08-01` → `2026-08-02`.
- `deriveCategory`: always+first-sunday → `always`; booking-only first-sunday → `first-sunday-booking`;
  months-subset → `first-sunday-low-season`; only july-14+events → `special-days`;
  only under-26 always → `under-26-only`; `freeAccess: []` → `none`.

### Task 4: Update script / scraper (TDD on fixture)

**Files:**
- Create: `scripts/update-parisjetaime.ts`, `scripts/lib/parseArticle.ts`,
  `scripts/lib/matchMuseums.ts`
- Test: `tests/parseArticle.test.ts`, `tests/matchMuseums.test.ts`

**Interfaces:**
- Consumes: fixtures (Task 2), `Museum`/`FreeRule` types (Task 3).
- Produces:
```ts
// parseArticle.ts
export interface ScrapedEntry { name: string; url?: string; sectionKey: string }
export interface ParsedArticle { entries: ScrapedEntry[]; sections: string[] }
export function parseArticle(html: string): ParsedArticle;
// section keys map to rule templates in update-parisjetaime.ts, e.g.
// 'always' → {kind:'always'}, 'first-sunday' → {kind:'nth-weekday',nth:1,weekday:'sunday'}, …
// matchMuseums.ts
export function normalizeName(s: string): string; // lowercase, strip accents/punct/stopwords(musée,de,du,la…)
export function matchMuseum(scrapedName: string, museums: Museum[], aliases: Record<string,string>): Museum | null;
```
- CLI behavior: reads `data/museums.json` + `data/aliases.json`; replaces every rule whose
  `source.url` contains `parisjetaime.com` with freshly scraped rules (`checkedAt` = today);
  never touches other rules; prints diff (per museum: rules added/removed; plus unmatched
  scraped names); exits non-zero on fetch/parse failure without writing; warns when
  `events.json` lacks next year's confirmed dates. `--dry-run` flag prints diff only.

**Steps:**
- [ ] Tests for `parseArticle` against the fixture: expects the known section set and
      spot-checks (e.g. entry "Musée Carnavalet" in section `always`; "Musée d'Orsay" in
      `first-sunday`). Implement with cheerio. Commit.
- [ ] Tests for `normalizeName` ("Musée d'Art Moderne de Paris" ≈ "musee art moderne paris")
      and `matchMuseum` (exact, normalized, alias, no-match→null). Implement. Commit.
- [ ] CLI glue + atomic write (write temp file, rename). Manual run `--dry-run` against
      live site logged in commit message. Commit.

### Task 5: Dataset curation (Workflow fan-out + verification)

**Files:**
- Create: `data/museums.json`, `data/events.json`, `data/aliases.json`
- Test: `tests/data.test.ts` (schema validation)

**Interfaces:**
- Consumes: fixtures (Task 2), types (Task 3).
- Produces: the canonical dataset consumed by the app and Tasks 13–14.

**Steps:**
- [ ] Normalize data.gouv fixture → base records (id slug, name, coords, address, CP,
      commune, department from CP, arrondissement for 750xx, website, hours).
- [ ] Workflow fan-out A: map every parisjetaime scraped entry (Task 4 parser output) onto
      base records; create records (researched coordinates) for listed venues missing from
      data.gouv (monuments such as Panthéon, Sainte-Chapelle, Arc de Triomphe…); attach
      rules with `source.url` = article URL.
- [ ] Workflow fan-out B: research non-Paris IDF majors (Versailles, Fontainebleau, MAN
      Saint-Germain-en-Laye, MAC VAL, Domaine de Sceaux, Basilique Saint-Denis, Villa
      Savoye, Musée de l'Air et de l'Espace, Château de Champs-sur-Marne, Maisons-Laffitte,
      Rambouillet, Port-Royal des Champs, Musée de la Grande Guerre Meaux, Musée français
      de la Photographie, départemental museums of 91/92/93/94/95, …) on official sites;
      each produced rule carries the official `source.url` and today's `checkedAt`.
- [ ] Workflow verify stage: independent agents re-check a sample + every `always` claim
      against sources; discrepancies fixed or rule dropped.
- [ ] `tests/data.test.ts`: unique ids; coords within IDF bbox (lat 48.1–49.3, lng 1.4–3.6);
      valid department; postal code ↔ department consistency; every rule has non-empty
      source url + ISO `checkedAt`; every `event` rule's key exists in `events.json`;
      arrondissement present iff CP starts `750`/`751`. Commit dataset + tests.

### Task 6: filters + distance + URL state libs (TDD)

**Files:**
- Create: `src/lib/filters.ts`, `src/lib/distance.ts`, `src/lib/urlState.ts`
- Test: `tests/filters.test.ts`, `tests/distance.test.ts`, `tests/urlState.test.ts`

**Interfaces (produces — exact):**
```ts
// distance.ts
export function haversineKm(a: [number,number], b: [number,number]): number; // [lng,lat]
// filters.ts
export interface FilterState {
  types: Category[];            // [] = all free types (category 'none' excluded)
  date: string | null;          // 'YYYY-MM-DD'
  center: [number,number] | null; radiusKm: number | null;
  departments: Department[]; communes: string[]; arrondissements: number[];
  under26: boolean; includePaid: boolean; query: string;
}
export const DEFAULT_FILTERS: FilterState;
export function applyFilters(museums: Museum[], f: FilterState, ctx: RuleContext,
  localizedNames: Record<string,string>): Museum[];
  // AND across dimensions; OR within one; date+types = rule-level AND
  // (≥1 rule matching a selected type AND active on date);
  // query: diacritic-insensitive substring on name + localized name
// urlState.ts
export function encodeFilters(f: FilterState): URLSearchParams;  // only non-defaults
export function decodeFilters(p: URLSearchParams): FilterState;  // tolerant of garbage
```

**Steps:**
- [ ] Tests: haversine Paris(2.3522,48.8566)→Versailles(2.1204,48.8049) ≈ 18.1±0.5 km.
- [ ] Tests: each dimension alone; combined type+date rule-level AND (museum with
      booking-only first-sunday not matched when `types:['first-sunday']`); paid hidden
      unless `includePaid`; under-26-only museum appears when `types:['under-26-only']`
      even with toggle off; arrondissement + commune OR-combined within area dimension?
      **No** — area sub-dimensions combine as OR (a museum passes area filter if it matches
      any selected département, commune, or arrondissement), dimension combines AND with others.
- [ ] Tests: encode→decode roundtrip; decode of invalid values → defaults. Implement, commit.

### Task 7: i18n framework + UI strings (en, fr)

**Files:**
- Create: `src/lib/i18n.ts`, `src/locales/en.json`, `src/locales/fr.json`,
  `src/components/LanguageSwitcher.tsx`, `src/lib/localeData.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `initI18n(): Promise<void>`; locale codes `en fr es it de zh-Hans zh-Hant ja ko ar`;
  `useMuseumContent(id): { name?: string; description?: string }` (lazy per-locale
  `data/i18n/museums.<locale>.json` via dynamic import, French locale returns nothing —
  French name is canonical); `document.documentElement` gets `lang` + `dir` (rtl for ar)
  on switch; detector order: querystring `lang` → localStorage → navigator.
- Complete `en.json` key set (all UI strings, incl. category names, filter labels, rule
  explanation templates with interpolation, a11y labels). `fr.json` full translation.
  Other 8 locales in Task 14.

**Steps:**
- [ ] Implement, wire into main.tsx (suspense fallback), manual dev-server check en/fr
      switch + `dir` flip when forcing `ar` (falls back to en strings until Task 14). Commit.

### Task 8: App shell, routing, state

**Files:**
- Create: `src/state/AppState.tsx` (context: museums, filters, selection, locale helpers),
  `src/components/Layout.tsx`, `src/components/Header.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Produces: routes `/` and `/museum/:id` (BrowserRouter, basename from `import.meta.env.BASE_URL`);
  `useAppState()` returning `{ museums, filtered, filters, setFilters, selectedId, select(id|null), ctx }`;
  filters ⇄ URL search params sync (Task 6 codec); selection syncs to route.
- Responsive frame per spec §6.1: ≥900px sidebar+map; <900px full-map + bottom sheet
  mount points. Header: title, search input, LanguageSwitcher, filter button (mobile).

**Steps:**
- [ ] Implement with placeholder panes; verify resize behavior and URL sync in browser. Commit.

### Task 9: MapView

**Files:**
- Create: `src/components/MapView.tsx`, `src/lib/mapStyle.ts`
- Modify: `src/state/AppState.tsx` (map moveend → optional center for distance)

**Interfaces:**
- Consumes: `filtered`, `selectedId`, `select`, `CATEGORY_COLORS`.
- Produces: MapLibre map, OpenFreeMap liberty style; GeoJSON source `museums` with
  `cluster: true, clusterMaxZoom: 11`; layers `clusters`, `cluster-count`,
  `museum-points` (circle, data-driven color by `category` property, white stroke,
  radius 6→8 on hover), `museum-selected` (filtered to selected id, larger + halo);
  click marker → `select(id)`; click cluster → zoom; geolocate + navigation + scale
  controls; RTL text plugin (`setRTLTextPlugin`, lazy); radius circle drawn as GeoJSON
  polygon when distance filter active; `flyTo` on selection (skipped when
  `prefers-reduced-motion`); map position persisted in location hash `#map=z/lat/lng`.

**Steps:**
- [ ] Implement; browser-verify markers/clusters/selection/geolocate at 3 widths. Commit.

### Task 10: FilterPanel + MuseumList + result count

**Files:**
- Create: `src/components/FilterPanel.tsx`, `src/components/TypeChips.tsx`,
  `src/components/AreaFilter.tsx`, `src/components/DistanceFilter.tsx`,
  `src/components/MuseumList.tsx`, `src/components/MuseumCard.tsx`,
  `src/components/ActiveFilterChips.tsx`
- Test: interaction sanity via browser; list rendering snapshot optional.

**Interfaces:**
- Consumes: `useAppState`, categories, `nextFreeDate`.
- Produces: full filter UI per spec §6.3 (type chips with category colors + icons;
  date section links to CalendarView (Task 11); distance: "use my location" /
  "pick on map" + log slider 1–100 km with live km label; area: département checkboxes,
  commune searchable multi-select (datalist-style combobox), arrondissement grid 1–20;
  under-26 toggle; include-paid toggle; reset button). MuseumCard: name (localized +
  French), category badge(s), commune + department, distance (when center set),
  next free date line, evening/booking icons. List sorted by distance when center set,
  else alphabetically; virtualized not needed (~150 items). Live region announces count.

**Steps:**
- [ ] Implement; browser-verify every dimension + combinations affect map+list identically;
      a11y pass with keyboard. Commit.

### Task 11: CalendarView + upcoming strip

**Files:**
- Create: `src/components/CalendarView.tsx`, `src/components/UpcomingFreeDays.tsx`
- Test: `tests/calendarCounts.test.ts` for the per-day count helper

**Interfaces:**
- Produces: `freeCountByDay(museums, year, month, ctx): Map<string, number>` in
  `src/lib/freeRules.ts` (added here, tested); month grid (Mon-first for fr/others,
  respecting locale via `Intl.Locale.prototype.getWeekInfo?.()` fallback Monday);
  day cells: count badge, today ring, event dot (event day) with "estimated" style
  when applicable; selecting a day sets `filters.date`; UpcomingFreeDays: next
  1st Sunday, next 1st Saturday, July 14, next museum-night/heritage-days with dates.

**Steps:**
- [ ] Test `freeCountByDay` on a 3-museum synthetic set for 2026-09. Implement + verify. Commit.

### Task 12: DetailPanel + BottomSheet

**Files:**
- Create: `src/components/DetailPanel.tsx`, `src/components/RuleExplanation.tsx`,
  `src/components/BottomSheet.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Produces: detail per spec §6.4 — localized name + French original (always, when locale
  ≠ fr), badges, per-rule human sentence via i18n templates
  (e.g. `rules.firstSunday` = "Free on the first Sunday of every month",
  `rules.months` suffix, booking link button, evening note, under-26 note),
  next free date (estimated flag), address block, opening hours, website link,
  Directions link (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`),
  distance line, source links ("Source: parisjetaime.com, checked 2026-08-06"),
  share button (navigator.share fallback clipboard) with deep link.
  BottomSheet: 3 detents (peek/half/full), drag + keyboard operable
  (button toggles, `aria-expanded`), focus trap in full state, `Esc` closes detail.
- Route `/museum/:id` opens panel directly (deep link/prerender target).

**Steps:**
- [ ] Implement; browser-verify at mobile width incl. drag, keyboard, `Esc`, deep link. Commit.

### Task 13: Museum descriptions (en + fr) (Workflow fan-out)

**Files:**
- Create: `data/i18n/museums.en.json`, `data/i18n/museums.fr.json`
- Test: extend `tests/data.test.ts` — every museum id has en+fr description, 1–3 sentences.

**Interfaces:**
- Shape: `{ [museumId]: { name?: string; description: string } }` (en has no `name`
  unless established English exonym exists, e.g. "Louvre Museum").

**Steps:**
- [ ] Workflow: batches of museums → agent writes factual 1–2 sentence descriptions
      (what it is, what's notable) grounded in known facts, no marketing fluff;
      verify agent spot-checks facts. Commit.

### Task 14: Remaining 8 locales (Workflow fan-out)

**Files:**
- Create: `src/locales/{es,it,de,zh-Hans,zh-Hant,ja,ko,ar}.json`,
  `data/i18n/museums.{es,it,de,zh-Hans,zh-Hant,ja,ko,ar}.json`
- Test: `tests/locales.test.ts` — every locale file has the exact key set of `en.json`
  (deep keys); museum files cover all ids; no empty strings.

**Steps:**
- [ ] Workflow: one agent per locale translating UI strings + museum name/description
      (museum `name` only when a conventional translated name exists — otherwise omit,
      UI falls back to French name); reviewer agent per locale checks naturalness +
      placeholder integrity (`{{count}}` etc.); ar reviewed for RTL-appropriate
      punctuation. Commit + browser spot-check `ar` end-to-end (layout mirrored).

### Task 15: PWA

**Files:**
- Create: `scripts/generate-icons.ts`, `public/icons/*` (generated), `src/components/UpdateToast.tsx`,
  `src/components/OfflineBanner.tsx`
- Modify: `vite.config.ts` (vite-plugin-pwa), `index.html` (manifest/meta/theme-color)

**Interfaces:**
- Produces: manifest (name "Free Museums Paris & Île-de-France", short_name "Free Museums",
  categories, maskable + any icons 192/512 + apple-touch 180, generated from an original
  SVG landmark/columns mark via sharp); Workbox: precache build assets + `data/*.json`;
  runtime cache `tiles.openfreemap.org` CacheFirst (maxEntries 400, 30 days);
  `registerType: 'autoUpdate'` + UpdateToast on `needRefresh`; OfflineBanner on
  `navigator.onLine === false`.

**Steps:**
- [ ] Implement; `npm run build && npm run preview`; verify manifest + SW registers +
      offline reload works (DevTools offline). Commit.

### Task 16: SEO prerender + sitemap + robots

**Files:**
- Create: `scripts/prerender.ts`, `public/robots.txt`
- Modify: `package.json` build script, `index.html` (meta description, OG defaults,
  JSON-LD WebSite)

**Interfaces:**
- Produces: post-build step reading `dist/index.html` + `data/museums.json` +
  en/fr descriptions → writes `dist/museum/<id>/index.html` with `<title>` =
  "<French name> — Free admission | Free Museums Paris", meta description (en) mentioning
  the free rule summary, OG tags, canonical URL, JSON-LD `Museum` (name, geo, address,
  url, sameAs website), `hreflang` alternates (`?lang=xx` × 10 + `x-default`);
  `dist/sitemap.xml` (all pages, absolute `https://travel-eu.github.io/free-museums-paris/…`);
  `dist/404.html` copy of shell for unknown client routes.

**Steps:**
- [ ] Implement; build; spot-check 2 generated files + sitemap validity. Commit.

### Task 17: A11y + polish audit

**Files:** touched as needed across components.

**Steps:**
- [ ] Keyboard-only walkthrough (browser): tab order, focus visibility, sheet trap,
      `Esc`, calendar arrows; fix findings.
- [ ] Landmarks/labels sweep (`nav`, `main`, `search`, aria-labels on icon buttons,
      list semantics `ul/li`, live region politeness).
- [ ] Contrast check of category colors on light/dark; adjust palette if any pair < 3:1
      against background (markers) or < 4.5:1 (text badges).
- [ ] `prefers-reduced-motion`: no flyTo/sheet animations. Commit.

### Task 18: CI, README, deployment docs

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`, `docs/DEPLOYMENT.md`

**Interfaces:**
- deploy.yml: on push main + `workflow_dispatch`: checkout → setup-node 24 + npm cache →
  `npm ci` → `npm run test` → `npm run build` → checkout
  `travel-eu/travel-eu.github.io` (token `secrets.DEPLOY_TOKEN`) into `site/` → replace
  `site/free-museums-paris/` with `dist/` → commit ("deploy free-museums-paris <sha>") →
  push. Skip deploy step (with notice) when secret absent so forks still CI-test.
- README (English): what/why, screenshots placeholder, features, data sources +
  licenses (Licence Ouverte attribution, OSM/OpenFreeMap attribution), dev setup,
  `npm run update-data` usage + cadence advice, i18n contribution notes, MIT.
- DEPLOYMENT.md: create org + both repos, generate PAT (fine-grained, contents:write on
  travel-eu.github.io), add secret, first push, custom-domain note.

**Steps:**
- [ ] Write all three; `actionlint`-style self-review of YAML. Commit.

### Task 19: Final verification + multi-agent review

**Steps:**
- [ ] `npm run test` full suite green; `npm run build` clean; bundle size sanity
      (maplibre dominates; app JS besides maplibre < 300 kB gz).
- [ ] agent-browser run-through: desktop 1440px, tablet 834px, phone 390px; scenarios:
      today's free museums, first-Sunday chip, date=2026-09-06, radius 3 km around
      user point, commune=Versailles, ar locale RTL, deep link `/museum/<id>`,
      offline reload. Screenshots archived to scratchpad.
- [ ] Workflow: multi-agent code review (correctness / a11y / i18n-RTL / data integrity /
      PWA) with adversarial verification of findings; fix confirmed issues; re-run tests.
- [ ] Final commit; summary to user with next steps (create org, push, set secret).
