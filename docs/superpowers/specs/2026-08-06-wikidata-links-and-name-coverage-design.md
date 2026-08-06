# Wikidata links, Google Maps place links, full name-translation coverage

Date: 2026-08-06. Status: implemented in the same session (autonomous run; requirements were fully specified by the user).

## Goals

1. Every museum in `data/museums.json` is linked to its Wikidata item, and the UI
   offers the museum's French Wikipedia article when one exists.
2. The detail panel offers a Google Maps **place** link (the listing with hours
   and reviews) alongside the existing directions link.
3. Every non-French locale shows a localized museum title (with the French name
   as subtitle); previously ~822 of 145×9 names were missing and fell back to
   the French name.
4. Explicitly out of scope (analysis only, per user): opening hours and user
   ratings data.

## Design

### Data

- Two new optional fields on `Museum` (`src/lib/types.ts`): `wikidata`
  (`Q…` item id) and `wikipediaFr` (full `https://fr.wikipedia.org/wiki/…`
  URL). They live directly in `data/museums.json`;
  `scripts/update-parisjetaime.ts` rewrites that file via
  `JSON.stringify(museums)` on the parsed objects, so unknown fields survive
  data updates.
- Enrichment is a repeatable script, `scripts/enrich-wikidata.ts`:
  `wbsearchentities` (fr + en, name variants) proposes candidates, batched
  `wbgetentities` fetches P625 coordinates / P856 website / labels / frwiki
  sitelink, and a candidate is accepted only when geography and identity agree
  (≤2 km + label similarity ≥0.5 or website match; or website match ≤10 km).
  Stragglers are pinned in the script's `OVERRIDES` map (`null` = no item
  exists). Alternatives rejected: bulk SPARQL by bounding box (coverage gaps
  for non-museum venue types), and LLM lookup of QIDs (unverifiable).

### UI

- `DetailPanel` actions row gains two external links: Google Maps place
  (`maps/search/?api=1&query=<name, address, postal code commune>` — a
  name+address query lands on the place card, unlike a coordinate pin) and
  Wikipédia (only when `wikipediaFr` exists). New i18n keys
  `museum.googleMaps` and `museum.wikipedia`; the wiki label states the article
  is in French in every locale except French itself.
- Prerendered JSON-LD `sameAs` becomes an array: website + Wikidata entity URL
  + frwiki URL.

### Name-translation coverage

- The missing-name audit is mechanical (script over `data/i18n/museums.*.json`),
  not model work. Translation itself is delegated to Sonnet agents (per the
  global no-translation-on-Fable rule), one agent per locale writing `name`
  into its own `museums.<locale>.json` — parallel, conflict-free. A separate
  Sonnet pass reviews the new names afterwards.
- `museums.fr.json` stays name-free by design: canonical names in
  `museums.json` are the French titles (enforced by test since the earlier
  fallback-leak fix).

## Testing

- `tests/data.test.ts`: QIDs well-formed and unique; `wikipediaFr` is an
  fr.wikipedia URL and implies `wikidata`.
- `tests/locales.test.ts`: after coverage lands, every non-fr locale must
  provide a `name` for every museum; fr must provide none.
- Existing key-parity test forces the two new UI strings into all 10 locales.
- Manual: build + browser pass over detail pages in fr/en/zh-Hans.

## Opening hours & ratings (analysis only — not built)

Recorded in the session summary; short version: hours are feasible via
OSM/DATAtourisme plus the existing `openingHours` field but carry a real
maintenance burden; ratings have no legally usable open source (Google/Trip
Advisor ToS forbid storing), so the Google Maps place link is the pragmatic
substitute.
