# Free Museums Paris & Île-de-France — Design Spec

**Date:** 2026-08-06
**Status:** Approved (user confirmed all scope questions; execution authorized end-to-end)
**Repo:** `travel-eu/free-museums-paris` (MIT) → deployed to `https://travel-eu.github.io/free-museums-paris`

## 1. Purpose

A map-first PWA that shows, clearly and exhaustively, every museum/monument in Île-de-France
and **how** it can be visited for free: always free, free on the first Sunday of each month
(with variants: booking required, low-season only), first Saturday (seasonal), monthly
nocturnes, July 14, Museum Night (Nuit européenne des musées), European Heritage Days
(Journées européennes du patrimoine), and free-for-under-26 (EU residents).

Users can answer two core questions instantly:

1. **"What is free today / on date X?"** — calendar-driven filtering.
2. **"What is free in way Y, near me / in area Z?"** — type + distance + area filtering.

## 2. Confirmed scope decisions

| Question | Decision |
|---|---|
| Paid museums with no free scheme | Included in data, rendered as muted markers, **hidden by default** (toggle to show) |
| Free info beyond Paris (rest of IDF) | Curated by hand from official sources (Versailles, Fontainebleau, MAN Saint-Germain-en-Laye, MAC VAL, Sceaux, Basilique Saint-Denis, Villa Savoye, Musée de l'Air et de l'Espace, etc.), each rule carries `source.url` + `checkedAt` |
| GitHub publishing | Prepare everything locally (repo, CI workflow, deploy docs). User creates the `travel-eu` org/repos and pushes |
| Extra free categories found on source page | All modeled: 1st Saturday (Oct–Jun), monthly nocturnes, July 14, under-26 EU (as audience-restricted badge + separate toggle, distinct from everyone-free types) |

## 3. Tech stack

- **Build:** Vite + React 18 + TypeScript (strict). No backend — fully static.
- **Map:** MapLibre GL JS with **OpenFreeMap** vector tiles (`liberty` style) — free, no API key, production use allowed.
- **PWA:** `vite-plugin-pwa` (Workbox): precache app shell + data JSON; runtime cache map tiles (cache-first, capped).
- **i18n:** `i18next` + `react-i18next`. Locales: `en, fr, es, it, de, zh-Hans, zh-Hant, ja, ko, ar`. Arabic gets full RTL (`dir="rtl"`, CSS logical properties throughout). Native `Intl.DateTimeFormat`/`Intl.PluralRules` for dates/plurals (no date library).
- **State:** React context + reducers; filter state mirrored to URL search params (shareable links). No heavy state library (~150 items).
- **Styling:** plain CSS with custom properties + CSS modules; light/dark via `prefers-color-scheme`; logical properties for RTL.
- **Tests:** Vitest for pure logic (free-rule date computation, filters, scraper parsing on HTML fixtures).
- **License:** MIT. README, code comments, commit messages: English. UI: 10 languages.

## 4. Data architecture

Data lives in-repo as JSON (systematic, versioned, diffable). App imports it at build time.

### 4.1 `data/museums.json` — canonical database

Array of museum records:

```ts
interface Museum {
  id: string;                  // stable slug, e.g. "musee-carnavalet"
  name: string;                // official French name (always displayed)
  coordinates: [number, number]; // [lng, lat] WGS84
  address: string;
  postalCode: string;
  commune: string;             // e.g. "Paris", "Versailles"
  arrondissement?: number;     // 1–20, Paris only (derived from postal code)
  department: '75'|'77'|'78'|'91'|'92'|'93'|'94'|'95';
  website?: string;
  phone?: string;
  openingHours?: string;       // free-text French from data.gouv, optional
  tags: string[];              // 'art' | 'history' | 'science' | 'monument' | ...
  freeAccess: FreeRule[];      // empty array = no known free scheme ("paid")
  parisjetaimeUrl?: string;    // detail page on source site, if listed there
}
```

### 4.2 `FreeRule` — rule-based, not enum-based

Rules compute "is museum M free on date D?" exactly, and display categories derive from them:

```ts
interface FreeRule {
  kind: 'always' | 'nth-weekday' | 'event' | 'annual-date';
  nth?: 1;                      // nth-weekday: first <weekday> of month
  weekday?: 'sunday' | 'saturday' | 'thursday' | ...;
  months?: number[];            // 1–12 subset; omitted = all year
  event?: 'museum-night' | 'heritage-days';
  date?: string;                // 'MM-DD' for annual-date (e.g. '07-14')
  evening?: boolean;            // nocturne: free during evening slot only
  audience?: 'everyone' | 'under-26-eu' | 'under-18';  // default 'everyone'
  reservationRequired?: boolean;
  reservationUrl?: string;
  note?: string;                // short French/English note, optional
  source: { url: string; checkedAt: string };  // provenance, ISO date
}
```

**Derived display category** (marker color + primary badge), by precedence:

1. `always` (everyone) → **Always free**
2. 1st Sunday all year, no booking → **1st Sunday**
3. 1st Sunday all year, booking required → **1st Sunday (booking)**
4. 1st Sunday, `months` subset → **1st Sunday (low season)**
5. 1st Saturday (seasonal) → **1st Saturday**
6. `evening` nocturne → **Monthly nocturne**
7. only `event`/`annual-date` rules → **Special days only**
8. only under-26 rules → **Under-26 only**
9. no rules → **No free admission** (muted, hidden by default)

Filter chips expose each concrete type (multi-select, OR within the dimension).

### 4.3 `data/events.json` — variable-date events

```json
{
  "museum-night":  { "2026": ["2026-05-16"], "estimatedRule": "3rd Saturday of May" },
  "heritage-days": { "2026": ["2026-09-19", "2026-09-20"], "estimatedRule": "3rd weekend of September" }
}
```

Confirmed dates listed per year; beyond them the UI computes an *estimated* date from the
rule and labels it "estimated". The update script warns when a new year needs confirming.

### 4.4 `data/i18n/museums.{locale}.json` — translated content

Per locale: `{ [museumId]: { name?: string; description: string } }`.
`name` present only where a conventional translation exists (e.g. 卢浮宫); the French
original is **always** shown on detail pages in non-French locales. Loaded lazily per locale.

### 4.5 UI strings

`src/locales/{locale}.json` — i18next resources, lazy-loaded, English fallback.

## 5. Data pipeline

### 5.1 Sources

1. **data.gouv.fr** "Liste des musées franciliens (IDF)" (Licence Ouverte) — base list:
   names, WGS84 coordinates, addresses, hours, websites. CSV resource
   `f3ebdc11-d45c-4b6f-8ef6-0e8e92f3e73e` / JSON `6c1502c9-5080-4138-a26f-cc2168042868`.
2. **parisjetaime.com** article `a961` — authoritative free-access categories for Paris:
   always-free, 1st Sunday (all-year / Oct–Mar / Nov–Mar), 1st Saturday (Oct–Jun),
   nocturnes, July 14, under-26.
3. **Hand-curated research** for the rest of IDF from official museum sites, each rule
   sourced (`source.url`, `checkedAt`). Also monuments missing from the data.gouv museum
   list but present on parisjetaime (e.g. Panthéon, Sainte-Chapelle) get records created.

### 5.2 `scripts/update-parisjetaime.ts` (manual, periodic)

Run with `npm run update-data`. It:

1. Fetches the parisjetaime article HTML.
2. Parses category sections → museum names + detail links (cheerio).
3. Matches names against `museums.json` (normalized/fuzzy match on name + alias table).
4. **Updates only rules whose `source.url` points to parisjetaime**; hand-curated rules
   from other sources are never touched.
5. Prints a human-readable diff (added / removed / changed / unmatched names) and rewrites
   `museums.json` with updated `checkedAt`. Unmatched scraped names are reported for
   manual triage, never silently dropped.
6. Warns if `events.json` lacks confirmed dates for the coming year.

Parsing logic is tested against a committed HTML fixture so site redesigns fail loudly.

## 6. App design

### 6.1 Layout (map + list, responsive)

- **Desktop/tablet-landscape (≥ 900px):** left sidebar (filters on top, scrollable result
  list below) + map filling the rest. Selecting a list item flies the map to it and opens
  the detail panel (overlaying the sidebar with a back button).
- **Mobile/tablet-portrait:** full-screen map; top bar = search + language + filter button
  (opens full-screen filter sheet with result count); bottom draggable sheet with three
  states — peek (result count + today chip), half (scrollable list), full (list).
  Tapping a marker opens the detail bottom sheet.
- Map and list are always two views of the same filtered set.

### 6.2 Map

- MapLibre GL + OpenFreeMap `liberty`; attribution OSM/OpenFreeMap.
- Museums as a GeoJSON source: colored circle markers by derived category (colorblind-safe
  palette), clustering below zoom ~11, cluster click zooms in.
- Selected museum: enlarged highlighted marker + fly-to.
- Distance mode: radius circle drawn around center (user location via Geolocation API, or
  long-press/click-set point); slider 1–100 km (log scale).
- Touch friendly: cooperative gestures not needed (full-screen map), pinch zoom, keyboard
  `+`/`-`, scale control, geolocate control, RTL text plugin for Arabic labels.

### 6.3 Filters (all combinable, AND across dimensions)

1. **Free type** — multi-select chips (OR within): Always free · 1st Sunday · 1st Sunday
   (booking) · 1st Sunday (low season) · 1st Saturday · Nocturne · July 14 · Museum Night ·
   Heritage Days · Under-26.
2. **Date** — "Free on…" calendar: Today shortcut, month grid with per-day counts; picking
   a date keeps only museums with an active rule that day (estimated event dates flagged).
3. **Distance** — center (my location / picked point) + radius slider.
4. **Area** — département multi-select (8), commune searchable multi-select, Paris
   arrondissement multi-select (1er–20e).
5. **Audience** — "Under-26 EU resident" toggle: treats under-26 rules as valid free access.
6. **Include paid museums** — off by default.
7. **Text search** — matches French + localized names, diacritic-insensitive.

Active filters shown as removable chips; result count always visible; one-tap "Reset".
Filter state serialized in URL query for shareable links.

### 6.4 Museum detail panel

French name (+ localized name), category badges, **plain-language explanation of every
free rule in the user's language** ("Free on the first Sunday of every month — booking
required", with reservation link), **next free date** computed (e.g. "Next: Sun 6 Sep 2026"),
address + arrondissement/commune/département, opening hours if known, distance from user,
website, "Directions" link (geo: / Google Maps), source attribution links, share button
(copies deep link `/museum/<id>`).

### 6.5 Calendar view

Month grid; each day shows count of free museums that day; today highlighted; event days
(Museum Night, Heritage Days, July 14, 1st Sundays/Saturdays) get badges. Tapping a day
applies the date filter. "Upcoming free days" strip (next 1st Sunday, next event days).

### 6.6 i18n & RTL

- 10 locales; auto-detect (navigator) with manual switcher (persisted, `?lang=` param).
- Arabic: `dir="rtl"` on `<html>`, logical CSS properties, mirrored layout, MapLibre RTL
  text plugin; numerals via `Intl`.
- Non-French locales always display the official French museum name alongside.

### 6.7 PWA

- Manifest (name/short_name localized to English + French, theme colors, maskable icons).
- Precache: app shell, data JSON, active-locale resources. Runtime: tiles/glyphs
  cache-first with expiration (≤ ~50 MB); app updates via `autoUpdate` + reload toast.
- Offline: full UI + data work offline; tiles limited to previously viewed areas (banner
  explains when offline).

### 6.8 SEO (light-touch)

- Build-time prerender script: for each museum, emit `museum/<id>/index.html` from the
  built shell with rewritten `<title>`, meta description (FR + EN), OpenGraph, JSON-LD
  (`schema.org/Museum` with geo, address, name). Also `sitemap.xml` + `robots.txt`.
- `hreflang` alternates via `?lang=` params. No SSR — this is deliberately minimal.

### 6.9 Accessibility

- Full keyboard operability (filters, list, calendar, detail panel); visible focus rings.
- The list view is the accessible equivalent of the map; markers are supplementary.
- ARIA: labelled controls, `aria-expanded`/`aria-selected` where relevant, live region for
  result count, focus trap + `Esc` in sheets/dialogs, focus restoration.
- Color: category palette meets contrast on both themes; category never encoded by color
  alone (badges have text/icons). `prefers-reduced-motion` disables fly-to animations.

## 7. Repository layout

```
free-museums-paris/
├─ README.md · LICENSE (MIT) · docs/DEPLOYMENT.md
├─ index.html · vite.config.ts · tsconfig.json · package.json
├─ public/            # icons, robots.txt
├─ data/              # museums.json · events.json · i18n/museums.<locale>.json
├─ scripts/           # update-parisjetaime.ts · prerender.ts · generate-icons.ts
│  └─ fixtures/       # parisjetaime.html test fixture
├─ src/
│  ├─ components/     # MapView · MuseumList · FilterPanel · CalendarView ·
│  │                  # DetailPanel · BottomSheet · LanguageSwitcher · …
│  ├─ lib/            # freeRules.ts · filters.ts · distance.ts · categories.ts · i18n.ts
│  ├─ locales/        # <locale>.json UI strings
│  └─ main.tsx · App.tsx
├─ tests/             # vitest specs for lib/ + scraper
└─ .github/workflows/deploy.yml
```

## 8. CI / deployment

`deploy.yml` on push to `main`: install → test → build with `base: '/free-museums-paris/'`
→ prerender → push `dist/` contents into `free-museums-paris/` directory of
`travel-eu/travel-eu.github.io` (checkout with `secrets.DEPLOY_TOKEN`, a PAT with write
access to that repo; commit + push). `docs/DEPLOYMENT.md` documents: creating the org, the
two repos, the token/secret, and first-deploy steps. Local `npm run build && npm run preview`
mirrors production paths.

## 9. Error handling

- Geolocation denied/unavailable → distance filter falls back to pick-a-point; clear message.
- Tile server unreachable → map shows plain background; list/filters fully functional; banner.
- Missing translation → English fallback (i18next); missing museum description → show
  French/English base text.
- Update script: network/parse failure → non-zero exit, no partial writes (atomic rewrite);
  unmatched museums reported, never guessed.
- Estimated event dates always visually flagged as estimates.

## 10. Testing strategy

- **Unit (Vitest):** `freeRules` (first-Sunday/Saturday computation incl. seasonal windows,
  July 14, event lookup + estimation, evening rules, audience logic), `filters`
  (combination semantics), `distance` (haversine), category derivation, URL state codec,
  scraper parser against committed fixture.
- **Data validation test:** JSON schema check over `museums.json` (ids unique, coords in
  IDF bounding box, departments valid, every rule has source).
- **Manual/visual:** browser run-through at phone/tablet/desktop widths, RTL spot-check,
  Lighthouse PWA + a11y pass.
