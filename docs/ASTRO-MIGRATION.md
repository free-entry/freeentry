# Astro migration plan

Replace the Vite + React SPA (whose per-museum SEO today is head-only, via
`scripts/prerender.ts`) with an **Astro static site**: every museum page gets
real HTML content in every locale, the interactive map stays a React island,
and the three-country builds, PWA, data pipeline and test suite keep working.

## Non-negotiable constraints

1. **Not a rewrite.** React 18 and the existing components stay (`@astrojs/react`).
   The map app (`App.tsx` tree: Layout, MapView, FilterPanel, AppState…) is kept
   as-is and mounted as a client island.
2. **Untouched:** `data/**`, `src/locales/**`, `data/*/i18n/**`, `scripts/**`
   (except deleting `scripts/prerender.ts` once Astro subsumes it),
   `public/**`. `src/lib/**` may gain small additive helpers but existing
   exports keep their behavior.
3. **All 232 existing vitest tests pass unchanged** (`npx vitest run`).
   Do not edit tests except for import-path mechanics if genuinely forced.
4. **URL space preserved.** `/museum/<id>` under the country base path keeps
   working with today's canonical form (no trailing slash in canonicals).
   Output format `directory` (i.e. `museum/<id>/index.html`), same as the
   current prerender output. GitHub Pages static hosting, no SSR.
5. **Three deployments** driven by the `COUNTRY` env var (`fr` default, `it`,
   `be`): `npm run build`, `build:it`, `build:be`, `dev`, `dev:it`, `dev:be`.
   Port `BASE_PATHS`, `MANIFESTS`, `ICON_DIR` and `siteUrl` wiring from
   `vite.config.ts` + `src/countries/` into `astro.config.mjs`.
6. **No new translation content.** Reuse the existing locale JSON only; never
   author or "fix" translated strings.
7. Work on the already-checked-out branch `astro-migration`. Commit in logical
   steps with messages matching the repo's style (`feat:`/`chore:`/`docs:`).
   Do **not** push.

## Target architecture

### Routes (per country deployment)

- `src/pages/index.astro` — home. Head: canonical, hreflang, WebSite JSON-LD
  (port from `scripts/prerender.ts`). Body: the map app as a
  `client:only="react"` island; runtime i18next language detection stays.
- `src/pages/museum/[id].astro` — English / `x-default` detail pages,
  `getStaticPaths` over `data/<country>/museums.json` (fr: 676).
- `src/pages/[locale]/museum/[id].astro` — the other nine locales
  (`fr, es, it, de, zh-Hans, zh-Hant, ja, ko, ar`; for it/be builds the
  canonical locale list comes from `src/countries/`). fr build ≈ 6 760 detail
  pages — fine for Astro.
- `src/pages/404.astro` — replaces the current copy-of-index 404 fallback:
  boots the map island so unknown in-app paths still work.

### Static detail-page content (the point of the migration)

Rendered to HTML at build time, per locale: localized name, header photo,
address + commune, description, the free-admission rules as human sentences,
opening hours, `closures`/`closedUntil`, `wheelchair`, `admission`, website /
Wikipedia links, category chips.

- **Extract a pure presentational component** (e.g. `DetailContent`) out of
  `src/components/DetailPanel.tsx` (457 lines, currently coupled to
  `useAppState()`). It takes `{ museum, content, notes, locale, t }` as props —
  no context, no router, no react-i18next hooks (pass a `t` function or
  pre-resolved strings so server rendering needs no provider). The SPA panel
  and the static page both render it, so content can never diverge.
- Reuse the pure functions in `src/lib/` (freeRules, openingHours, format,
  categories, localeData fallback semantics) in frontmatter at build time.
- **Date-dependent UI must not be baked in** ("free today", "open now",
  upcoming-free-days calendar): that part is a small hydrated island
  (`client:idle`); the static baseline is the timeless rules text.
- Build-time i18n: per-locale i18next instances created synchronously
  (`initImmediate: false`, resources from `src/locales/<l>.json`); museum
  content from `data/<country>/i18n/museums.<l>.json` + `notes.<l>.json` with
  the English-fallback rules of `src/lib/localeData.ts`.
- `lang` attribute per page; `dir="rtl"` for `ar`.

### SPA ↔ static-page interplay

- Inside the map app, selecting a venue keeps today's behavior (panel +
  `pushState` to `/museum/<id>`, no reload). A hard load of that URL now gets
  the static content page instead of the empty shell — that is the intended
  change.
- The static detail page gets a prominent "see on the map" link into the app
  (`<base>/?museum=<id>` or whatever `src/lib/urlState.ts` already supports —
  check it; wire the app to focus that venue on load if it doesn't already).

### Head / SEO

Port `museumHead()` from `scripts/prerender.ts` into a Base layout:
title, meta description, OG, JSON-LD `Museum` (add `inLanguage`), canonical
(each locale page canonicalizes to itself), hreflang alternates now pointing at
**real locale paths** (x-default = the root English route) instead of `?lang=`
query variants. Sitemap covers home + every detail URL in every locale
(custom endpoint or `@astrojs/sitemap`). Keep `robots.txt`. Then delete
`scripts/prerender.ts` and drop the post-build step from `package.json`.

### PWA

`@vite-pwa/astro` with the current manifest + workbox config ported from
`vite.config.ts`. Critical change: **do not precache thousands of museum HTML
pages** — restrict `globPatterns` to the app shell + assets, keep
`navigateFallback` to the base `index.html` (offline → map app, which renders
venue info client-side), keep both `runtimeCaching` entries (OpenFreeMap tiles,
museum photos).

### Toolchain

- `astro.config.mjs`: base/site per country, `@astrojs/react`, PWA integration,
  `@` alias, `manualChunks: { maplibre }` via the `vite` key.
- Delete `index.html` and `vite.config.ts` when their jobs are fully ported
  (the `%VITE_*%` head substitutions become layout props; vitest config moves
  to `vitest.config.ts` since it currently lives in `vite.config.ts` —
  the `test` block must survive the move).
- `tsconfig.json` updated for Astro; `npm run build` = typecheck (tsc for
  ts/tsx and/or `astro check`) + `astro build`.
- `postinstall` RTL-plugin copy (`scripts/copy-rtl-plugin.mjs`) must keep
  working; check where it copies to and adjust if the target moved.

### Optional (do last, only if everything else is green)

`src/state/AppState.tsx` eagerly globs `data/*/museums.json`, which bundles all
three countries' data into every deployment. Switching to a country-scoped
import shrinks the bundle; nice-to-have, separate commit.

## Acceptance checklist — verify every item before declaring done

1. `npx vitest run` → all 232 tests pass, unchanged.
2. Typecheck clean; `npm run build` (fr) succeeds.
3. In fr dist, for ≥3 sample ids (one always-free, one nth-weekday, one with
   closures): `museum/<id>/index.html` **body** contains the venue name,
   address and at least one free-rule sentence (grep it — not just the head);
   `fr/museum/<id>/index.html` contains the French text.
4. `npm run build:it` and `build:be` succeed with their base paths (370 / 210
   venues respectively).
5. `sitemap.xml` lists home + all detail URLs including locale routes;
   hreflang tags are path-based; canonicals keep today's form.
6. Service worker generated; its precache manifest does NOT include per-museum
   HTML (spot-check).
7. `npm run dev` boots and serves the map island on `/`.
8. `git status` clean at the end apart from intentionally untracked scratch
   files (`cal.html`, `cd.html` — leave them alone); no changes under `data/`.
