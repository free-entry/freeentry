# Countryization — one codebase, N country deployments

Date: 2026-08-06. Status: approved direction (user), to be executed right
after France phase 1 lands. Countries in order: FR (existing), IT, BE, then
ES / UK / DE per the research ranking.

## Decision

One monorepo; country is a **data + config dimension**, not a fork and not a
runtime switch. Each country ships as its own deployment
(`/free-museums-<country>/`, own titles/SEO), all sharing every component,
pipeline and test.

## Layout

```
data/<cc>/museums.json events.json aliases.json overrides.json
data/<cc>/i18n/museums.<locale>.json notes.<locale>.json
src/countries/<cc>.ts        ← config (see below)
scripts/sources/<cc>/*.ts    ← per-aggregator updaters (update-parisjetaime
                               pattern: one official page → one script)
scripts/fixtures/<cc>/
```

## Country config (`src/countries/<cc>.ts`)

- `bbox` — data sanity bounds (tests + map fallback framing)
- `adminAreas` — model of the admin-area hierarchy: `{ code → name }` map,
  postal-code validation fn, optional intra-city district model (FR:
  departments + arrondissements 75/69/13; IT: province codes; BE: regions;
  UK: ceremonial counties…)
- `brand` — per-locale `{title, titleShort, metaDescription}` (translated by
  the usual Sonnet pipeline per country); shared UI strings stay in
  `src/locales/*.json`
- `basePath`, `siteUrl`, `repoUrl`
- `eventKeys` — which event calendars exist (FR: museum-night,
  heritage-days; IT/BE: initially none — national fixed dates are
  annual-date rules, not events)

## Build & runtime

- `VITE_COUNTRY=<cc>` selects the country at build time; data loading globs
  `../../data/<cc>/…`; vite `base`, PWA manifest and prerender all read the
  config. Default stays `fr` so existing workflows keep working.
- Deploy: workflow matrix over countries → separate Pages targets.
- Tests: every suite loops over the countries present under `data/`,
  using each country's config for bbox/admin validation. Content-coverage
  and note-catalog tests run per country.

## Schema deltas required by the next two countries

- IT: none. Domenica al Museo is a plain `nth-weekday` rule (one source URL
  covers ~480 venues); 4/25, 6/2, 11/4 are `annual-date` rules; under-18 is
  an `always` rule with audience `under-18`.
- BE: two additions —
  1. `audience: 'residents'` (Ghent first-Sunday, KölnTag-style schemes
     later; rendered with a "residents only" sentence + note),
  2. `kind: 'weekly'` (weekday + optional evening) for Ghent's Late
     Donderdag / Nantes-style evening openings. Renderer + freeRules
     evaluation + filters gain the case; tests pin it.

## Identity keys per country

- FR: wikidata + museofile (+ CMN site hosts)
- IT: wikidata + DBUnico id (CC-BY national register)
- BE: wikidata (+ FWB list membership; no national register)
- Cross-check pipelines (wikidata coords/links, images P18+wiki-lead,
  freshness watchdog) are country-agnostic already; the datagouv differ gets
  a per-country register adapter (FR Muséofile, IT DBUnico).

## Non-goals

- No runtime country switcher, no pan-European map (SEO + data-volume
  reasons; can be revisited once several countries are live).
- No shared "Europe" brand — each site keeps its country identity.
