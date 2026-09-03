# SEO plan — static hub pages, locale home pages, head/URL hygiene

Binding plan for the SEO pass on top of the Astro migration
(`docs/ASTRO-MIGRATION.md`). Audit date: 2026-09-03, branch `astro-migration`.

## Audit findings (why each item below exists)

1. **Orphan pages / no crawlable link graph.** The home page body is an empty
   `#root` with a `client:only` island: zero text, zero links. All ≈6 760
   museum pages are reachable only through `sitemap.xml`, and no museum page
   links to any other museum page. Nothing targets the head queries
   ("musées gratuits France", "free museums Paris", "musées gratuits premier
   dimanche du mois"…).
2. **Canonicals point at redirecting URLs.** Output is `museum/<id>/index.html`
   (GitHub Pages 301s `/museum/<id>` → `/museum/<id>/`) but canonical, `og:url`,
   hreflang, sitemap and JSON-LD `url` all use the slash-less form.
3. **Home hreflang is meaningless**: ten `hreflang` links all pointing at `/`.
   The home page exists only with an English head, so a French searcher sees
   an English title.
4. **Header photo is a CSS `background-image`**: invisible to image search, no
   `og:image`, no `image` in JSON-LD, no `alt`, and it is the LCP element with
   no `fetchpriority`. Originals are ≤1200 px JPEG, avg 176 KB.
5. **Sitemap** has no `lastmod`, no `xhtml:link` hreflang alternates, and one
   734 KB file per country.
6. **Thin structured data**: no `BreadcrumbList`, no `image`/`description`/
   `telephone`/`openingHoursSpecification` on `Museum`, no `SearchAction` on
   `WebSite`; no `og:site_name`/`og:locale`/Twitter cards.
7. **Small bugs**: category chip row renders `aria-label="filters.typeLabel"`
   (missing key); the static page shows "Back to results" twice (top link and
   the primary map action share `museum.back`).
8. **SW bug (existing)**: `navigateFallback` serves the app shell for *every*
   navigation once the service worker is installed, and the SPA router has no
   route for `/<locale>/museum/<id>/` → returning visitors opening a localized
   museum URL get "Museum not found". Any new static route would hit the same
   fallback.

## Non-negotiable constraints

- Untouched: `data/**`, `public/images/**`, `scripts/**` (new scripts may be
  added; existing ones stay). No new translation content: **never author or
  edit non-English UI strings** — add new keys to `src/locales/en.json` and copy
  the *identical English text* into the other nine locale files as
  placeholders (the parity test requires it). A separate translation pass
  replaces the placeholders; list every new key in your final report.
- All existing vitest tests pass unchanged (`npx vitest run`, 232 today). Add
  tests for new pure helpers.
- Three builds keep working: `npm run build`, `build:it`, `build:be`.
- Keep the SPA behavior (map, filters, panel, offline) working; it is the
  product. SEO pages are additive.
- Commit in logical steps (`feat:`/`fix:`/`chore:`/`docs:`), do not push.

## URL space (per country deployment, under `COUNTRY.siteUrl`)

English at the root, the other nine locales under `/<locale>/`, **always
with a trailing slash** (Astro `trailingSlash: 'always'`, `build.format:
'directory'`). Path segments stay English in every locale (like `museum`).

| Page | English | Other locales |
|---|---|---|
| Home (map app) | `/` | `/<locale>/` |
| Museum | `/museum/<id>/` | `/<locale>/museum/<id>/` |
| Index of everything | `/museums/` | `/<locale>/museums/` |
| Admin area (FR département, IT provincia, BE province) | `/area/<slug>/` | `/<locale>/area/<slug>/` |
| City (commune) | `/city/<slug>/` | `/<locale>/city/<slug>/` |
| Free-admission type | `/free/<category>/` | `/<locale>/free/<category>/` |

Slugs: `slugify(name)` (NFD, strip diacritics, lowercase, `[^a-z0-9]+` → `-`,
trim `-`). Area slug from `COUNTRY.adminAreas.names[code]`; city slug from
`commune`. If two communes share a slug within a country, suffix the area
code (`-<code>`) on every colliding one. A vitest test asserts uniqueness per
country.

Which pages exist:
- Area pages: every area that has ≥1 venue.
- City pages: communes with **≥2 venues**, except when the commune's venue
  set equals its area's venue set (Paris = département 75): then no city
  page; the area page is the city page and breadcrumbs skip the city level.
- Category pages: every `Category` (src/lib/categories.ts) except `none` that
  has **≥3 venues** in this country, membership = `deriveCategories(museum)`
  includes the category.

## Shared building blocks

### `src/lib/seo.ts` (extend, keep existing exports working)
- `detailPath(id, locale)` → trailing slash. `homePath(locale)` →
  `/` or `/<locale>/`. `hubPath(kind, slug, locale)`.
- `localePrefix(locale)` → `''` or `'<locale>/'`.
- `alternatesFor(pathBuilder)` → the 10 hreflang links + `x-default` (= en).
- `freeSummary` exported (used by hub lists).
- `museumSeo()` changes: title `${name}, ${commune} — ${summary} | ${brand}`;
  description = `${summary} · ${commune}. ${description}` truncated on a word
  boundary to 155 chars (78 for `zh-Hans`, `zh-Hant`, `ja`, `ko`) with `…`;
  `jsonLd` becomes an **array**: the venue node + `BreadcrumbList`.
  Venue node: `@type` `["Museum","TouristAttraction"]` when tags include
  `museum`, else `["LandmarksOrHistoricalBuildings","TouristAttraction"]`;
  add `description`, `image` (absolute URL of the original JPEG),
  `telephone` (when `phone`), `hasMap` (the Google Maps place URL),
  `publicAccess: true`, `openingHoursSpecification` (see below), keep
  `sameAs`, `address`, `geo`, `isAccessibleForFree`, `inLanguage`; `url` with
  trailing slash; drop `alternateName` when it only differs by apostrophe
  style (compare after NFKC + `’`→`'`).
- `hubSeo(...)` for the four hub kinds: title `${h1} | ${brand}`, description
  from the `hub.meta*` keys, canonical, alternates, `jsonLd`:
  `CollectionPage` (`name`, `url`, `inLanguage`, `isPartOf` the WebSite) +
  `BreadcrumbList`.
- `homeSeo(locale)`: localized title/description via `brandString` semantics
  (`COUNTRY.brand?.[locale]` → else `app.title` / `app.metaDescription` from
  the locale bundle); `WebSite` JSON-LD with `inLanguage: locale`, `url` of
  that locale's home, and `potentialAction: SearchAction` targeting
  `${siteUrl}/${prefix}?q={search_term_string}` (`query-input:
  required name=search_term_string`; the SPA already reads `q`).

### `src/lib/openingHours.ts`
Add `parseOpeningHours(raw): OpeningHoursSpecification[] | null` covering the
same restricted grammar the renderer handles: day ranges/lists + one or more
time ranges → `{ "@type": "OpeningHoursSpecification", dayOfWeek: [...],
opens, closes }`; `off` rules and `PH` are skipped; month-limited rules and
anything the grammar rejects → return `null` for the whole string (emit
nothing rather than something wrong). Tests.

### `src/lib/hubs.ts` (new, pure, tested)
`slugify`, `buildHubIndex(museums, country)` → `{ areas, cities, categories }`
with slugs, venue lists, counts, and `cityPageExists(commune)`;
`nearbyMuseums(museum, all, n=6)`: same commune first (excluding self), then
by `haversineKm`, stable order. Areas/cities sorted with `Intl.Collator`
per locale at render time.

### `BaseLayout.astro`
Props: `title`, `description`, `lang`, `canonicalPath`, `alternates`,
`ogType`, `ogImage?: { url, width, height, alt }`, `jsonLd?: object | object[]`,
`noindex`. Emits, in addition to today's tags: `og:site_name` (brand
titleShort), `og:locale` (`en_US fr_FR es_ES it_IT de_DE zh_CN zh_TW ja_JP
ko_KR ar_AR`) + `og:locale:alternate` for the others, `og:image` (+`:width`,
`:height`, `:alt`) — fallback image is `${siteUrl}/${iconDir}/icon-512.png`
512×512 —, `twitter:card` (`summary_large_image` with a photo, else
`summary`), `twitter:title/description/image`, and
`<meta name="robots" content="max-image-preview:large">` on indexable pages.
`jsonLd` array → one `<script type="application/ld+json">` per node.

### Static page chrome — `SiteHeader.astro`, `SiteFooter.astro`
Used by museum and hub pages (not by the map app pages).
- Header: wordmark link → localized home (`list.showMap` label for the map
  link is fine), a `<nav aria-label={t('hub.browse')}>` with
  `hub.allMuseums` → `/museums/`, and a no-JS language menu
  (`<details><summary>` with the current `LOCALE_NAMES` entry; `<ul>` of the
  ten alternates as `<a hreflang lang href>` for the *current page*).
- Footer: category links (the category pages that exist), `hub.allMuseums`,
  map link, GitHub link, `about.disclaimer` text.
Keep it light (plain CSS in the component; reuse `global.css` tokens). RTL
must still work (`dir` is already on `<html>`).

## Museum pages (`MuseumPage.astro` / `DetailContent.tsx`)

1. Breadcrumb `<nav aria-label="Breadcrumb"><ol>`: `hub.home` →
   home; area name → `/area/<slug>/`; city (only if a city page exists) →
   `/city/<slug>/`; current name (no link). Same trail as the JSON-LD.
2. Photo → real `<img>` inside the header: `src` = original JPEG,
   `alt` = localized name, `width`/`height` from the file (read once at build
   with `sharp` metadata, cached in a module-level map — Node only, static
   pages only), `fetchpriority="high"`, `decoding="async"`, object-fit cover,
   absolutely positioned behind the existing gradient/text so the design
   does not change. The SPA panel may keep its background-image path or
   share the `<img>` — whichever keeps `DetailContent` pure and the visual
   identical. Then serve responsive variants: use Astro's image service
   (`getImage` from `astro:assets` on images imported via
   `import.meta.glob('../../public/images/museums/*.jpg')` or an equivalent
   build-time approach) to emit **WebP at 640 and 1024 px** into `_astro/`,
   used via `<picture>`/`srcset` with `sizes="(min-width: 54rem) 52rem, 100vw"`;
   the JPEG stays the fallback and the `og:image`. Only the active country's
   images may be processed (glob per `COUNTRY_CODE`). If this proves too
   slow or unstable in CI-sized builds, ship the `<img>` change alone and
   say so in the report.
3. "See on the map" primary action: new key `museum.seeOnMap`, href
   `${homePath(locale)}?museum=<id>`. The top-left back link keeps
   `museum.back` but points at the localized home.
4. New section after the description: `hub.nearby` (h2) — up to 6
   `nearbyMuseums` as links (localized name, commune, primary category
   label), then a `hub.moreIn` link to the city page (if it exists) and the
   area page.
5. Fix `aria-label={t('filters.typeLabel')}` → `filters.freeType`.
6. `MuseumDateStatus` island unchanged.

## Hub pages

`src/pages/museums/index.astro`, `src/pages/area/[slug].astro`,
`src/pages/city/[slug].astro`, `src/pages/free/[category].astro`, and the
`[locale]/…` twins — share one `HubPage.astro` component. Per locale
i18n via `createStaticI18n(locale)`; venue names/descriptions via the
existing static content helpers (English fallback semantics).

- **Index** (`/museums/`): h1 `hub.indexTitle` (`{{country}}` from the
  `country.<code>` key), intro (`app.tagline` + `hub.metaIndex`), then
  `hub.byType` list of category pages with counts, `hub.byArea` — one `<h2>`
  per area (link to the area page, count) with the venue list under it, and
  `hub.byCity` links for communes with a city page.
- **Area**: h1 `hub.placeTitle` with the area name; venues grouped by commune
  (`<h2>` = commune, linked when a city page exists; Paris grouped by
  arrondissement using `filters.arrondissementLabel`).
- **City**: h1 `hub.placeTitle`; flat list.
- **Category**: h1 `hub.categoryTitle` (`{{category}}` = `categories.<key>`);
  grouped by area. For `special-days` in countries with `eventKeys`, add a
  `hub.confirmedDates` block listing `events.json` confirmed dates per
  event and year (`calendar.events.*` labels, `formatDate`) — timeless facts,
  fine to bake.
- Venue list item: link (localized name) + original name when different and
  locale ≠ canonical, commune, `freeSummary` sentence, category badge
  labels (text). No dates, no "today".
- Every hub page: breadcrumb (Home › [Index] › page), `SiteHeader`,
  `SiteFooter`, counts via `filters.resultCount`.

## Home pages

- `src/pages/index.astro` (en) and `src/pages/[locale]/index.astro`
  (nine locales, `getStaticPaths` over `LOCALES` minus `en`): `homeSeo(locale)`
  head, `lang`/`dir`, canonical `homePath(locale)`, alternates = ten home
  URLs (+ x-default `/`).
- Body: `<div id="root"><MapApp client:only="react" initialLocale={locale}>`
  with **fallback slot content** (`<div slot="fallback">`, rendered in the
  static HTML and removed when the island mounts): `<h1>` localized title,
  `app.tagline`, meta description text, and a `<nav>` of crawlable links:
  `hub.allMuseums` → `/museums/`, the category pages, and the top 12 areas +
  top 12 cities by venue count. Style it as a plain readable page (it is also
  the no-JS experience).
- `src/pages/404.astro` unchanged (noindex, boots the app).

## SPA changes (React app)

1. `App.tsx` routes: `/`, `/museum/:id`, `/:locale`, `/:locale/museum/:id`.
   `:locale` must be in `LOCALES` (else `NotFound`). A `LocaleRoute` wrapper
   calls `i18n.changeLanguage(locale)` when the path locale differs from the
   active one. `AppState.routeId` parses both prefixed and unprefixed museum
   paths and `?museum=` on either home.
2. `MapApp` accepts `initialLocale?: Locale`; `initI18n(initialLocale)`
   passes it as `lng` (explicit locale beats detection). The root `/` keeps
   today's detection (`?lang`, localStorage, navigator, fallback fr).
3. `select(id)` and `DetailPanel.shareUrl` produce
   `${BASE_URL}${prefix}museum/${id}/` (trailing slash, locale prefix kept).
4. `LanguageSwitcher.select(locale)`: instead of setting `?lang=`, navigate
   (react-router, `replace: true`) to the same page under the new prefix
   (`/fr/museum/x/` → `/es/museum/x/`, `/es/` → `/`), preserving search
   params minus `lang`. `?lang=` deep links keep working on load.
5. `Header` wordmark links to the localized home.

## PWA / service worker

- `globIgnores`: also `museums/**`, `*/museums/**`, `area/**`, `*/area/**`,
  `city/**`, `*/city/**`, `free/**`, `*/free/**`.
- `navigateFallbackDenylist`: hub paths (`/(?:[\w-]+/)?(?:museums|area|city|free)/`
  under the base path), so they are always fetched from the network; add a
  `runtimeCaching` `NetworkFirst` entry (`cacheName: 'static-pages'`,
  ≤60 entries) for those same paths so a visited hub page still opens
  offline. Museum URLs and home URLs keep the shell fallback (the router now
  handles the locale prefix — this fixes finding 8).

## Sitemap and robots

- `sitemap.xml` becomes a **sitemap index** listing `sitemap-<locale>.xml`
  (ten files). Each locale file lists that locale's home, index, area, city,
  category and museum URLs, each `<url>` carrying `<lastmod>` and the eleven
  `<xhtml:link rel="alternate" hreflang=…>` entries (the ten locales +
  `x-default`). Declare `xmlns:xhtml`.
- `lastmod` (ISO date, stable across builds): museum → max of its rules'
  `checkedAt` and `openingHoursSource.checkedAt`; hub → max over its venues;
  home/index → max over all venues.
- Put the sitemap builder in `src/lib/sitemap.ts` (pure, tested); the Astro
  endpoints only call it.
- `robots.txt.ts` unchanged (still points at `/sitemap.xml`).

## New UI keys (add to `en.json`; copy the English text verbatim into the other nine files)

```
country.fr = "France"
country.it = "Italy"
country.be = "Belgium"
museum.seeOnMap = "See on the map"
hub.browse = "Browse"
hub.home = "Home"
hub.allMuseums = "All free museums and monuments"
hub.byArea = "By area"
hub.byCity = "By city"
hub.byType = "By type of free admission"
hub.nearby = "More free museums nearby"
hub.moreIn = "All free museums in {{place}}"
hub.confirmedDates = "Confirmed dates"
hub.indexTitle = "All free museums and monuments in {{country}}"
hub.placeTitle = "Free museums and monuments in {{place}}"
hub.categoryTitle = "{{category}} — museums and monuments in {{country}}"
hub.metaIndex = "{{total}} museums and monuments you can visit for free in {{country}}, by area, city and type of free admission, with addresses and free-admission rules."
hub.metaPlace = "{{total}} free museums and monuments in {{place}}: always free, first Sundays, special days — with addresses, opening days and free-admission rules."
hub.metaCategory = "{{total}} museums and monuments in {{country}}: {{category}}. Addresses, free-admission rules and directions."
```

Use `{{total}}` (not `count`) so i18next does not apply plural rules. If you
need any other string, add it the same way and list it in the report.

## Docs

- `README.md`: architecture paragraph reflects Astro (static per-locale
  museum + hub pages, map app island, PWA), `Development` commands, project
  layout (`src/pages`, `src/layouts`, `scripts/prerender.ts` is gone).
- `docs/DEPLOYMENT.md`: note that GitHub Pages only serves the **root**
  `404.html` of the umbrella site (per-project `404.html` is not used) and
  the Search Console / Bing Webmaster steps: verify `freeentry.org`, submit
  the three `sitemap.xml` index URLs.

## Acceptance checklist — verify every item before declaring done

1. `npx vitest run`: all existing tests pass; new tests for `slugify`/hub
   index uniqueness, `nearbyMuseums`, `parseOpeningHours`, sitemap builder,
   `detailPath`/`homePath`/`hubPath` forms, `museumSeo` title/description
   truncation.
2. `npm run build`, `build:it`, `build:be` succeed. Report page counts per
   route kind per country.
3. In fr dist: `museum/<id>/index.html` for 3 sample ids contains `<img`
   with `alt`, a breadcrumb, the nearby section with ≥3 internal links, a
   canonical ending in `/`, `og:image`, ≥2 `application/ld+json` scripts
   (one `BreadcrumbList`); `fr/museum/<id>/index.html` is French; no
   `filters.typeLabel` anywhere in dist (`grep -r`).
4. `dist/index.html` and `dist/fr/index.html` contain the fallback `<h1>`
   and ≥20 internal links; heads differ by language; canonical `/` vs `/fr/`.
5. `dist/museums/index.html`, one area, one city, one category page exist
   in en and fr with h1, breadcrumb, lists, `CollectionPage` JSON-LD.
6. `dist/sitemap.xml` is a sitemap index of 10 files; `sitemap-fr.xml`
   contains every fr museum + hub + home URL with `lastmod` and 11 `xhtml:link`
   per URL; every `<loc>` ends with `/`.
7. Service worker precache contains no `museum/`, `museums/`, `area/`,
   `city/`, `free/` HTML; the generated `sw.js` contains the denylist.
8. No baked dates in any static HTML (`grep -rL` for "Free today"/"Next free
   day" strings across locales is a good proxy; the date island stays empty
   server-side).
9. `npm run dev` serves `/`, `/fr/`, `/museum/<id>/`, `/fr/museum/<id>/`,
   `/museums/`, `/area/<slug>/` (curl the dev server and grep).
10. `git status` clean except `cal.html`/`cd.html`; nothing under `data/`
    or `public/images/` changed.

## Status (2026-09-03)

Implemented on `astro-migration` in commits `b4b4d80` … `ddde54c` (Codex) and
`50fd019` (translations of the 19 new keys, Workbox runtime-cache pattern
anchored to the origin, nearby venues require the same admin area).
Builds: fr 8 761 pages, it 5 081, be 2 501; 252 vitest tests.

Deviations from the plan above:

- **Responsive WebP variants now ship through a dedicated pre-build step.**
  `scripts/build-image-variants.ts` uses Sharp with eight workers to generate
  quality-78 WebPs at 480, 800 and 1200 px when those widths are smaller than
  the source, plus a source-width WebP for photos narrower than 1200 px. The
  incremental output lives in gitignored `public/images/derived/`; static
  detail pages use it in `<picture>` while the original JPEG remains the
  `<img>` and `og:image` fallback. On this machine, a clean France run created
  1 230 files in 15.4 s (`npm run build`: 1m12.819s total); the warm step
  skipped all 1 230 in 0.1 s (58.202s total).
- Eighteen French venues carry no dated source; their sitemap `lastmod`
  falls back to the country's newest source date.

Locale rule in the SPA (settled after a browser smoke test, 2026-09-03):
the path prefix owns the UI language. `/<locale>/…` is that locale;
unprefixed paths are English — except the bare home `/` (no `?museum=`),
which is the auto-detect entry (PWA start URL, typed domain, legacy
`?lang=` links): after i18next detection it redirects once, before the router
mounts, to `/<locale>/` when the result is not English. `/?museum=<id>` (the
English static page's map link) and `/museum/<id>/` (service-worker shell)
stay English. The language switcher awaits `changeLanguage` and then
navigates to the same page under the new prefix, reading `window.location`
for search/hash because filters and the map write the URL with
`replaceState`, which react-router never observes. The router `basename`
keeps its trailing slash so the root route is `/free-museums-france/`, not
the bare basename.

Still manual (see `docs/DEPLOYMENT.md`): DNS + custom domain on the umbrella
Pages repo, root `robots.txt` and `404.html` there, Search Console / Bing
sitemap-index submission.
