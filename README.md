# Free Museums — France

Interactive map PWA of every museum and monument you can visit for free — and
exactly **when** and **how**: always free, free on the first Sunday of the month
(including booking-required and low-season variants), first Saturdays, monthly
free evenings, 14 July, the European Museum Night, the European Heritage Days,
and under-26 (EU) free admission.

France is the primary deployment; the same engine also ships Italian and Belgian
datasets from `data/it/` and `data/be/` (`npm run dev:it`, `npm run dev:be`).

**Live app:** <https://travel-eu.github.io/free-museums-france/>

## Features

- **Map-first UI** — MapLibre GL with OpenStreetMap vector tiles (OpenFreeMap),
  colorblind-safe category markers, clustering, hover previews, and a synced
  result list. Desktop sidebar layout; draggable bottom sheet on phones.
- **Rule engine, not labels** — every free-admission scheme is stored as a
  machine-readable rule (`always`, first/last weekday of month with seasonal
  windows, annual dates, variable-date events), so the app can answer
  *"what is free on any given date?"* exactly.
- **Rich filtering, all combinable** — free-admission type, calendar date
  (with per-day counts), distance radius around you or any picked point,
  département / commune / Paris arrondissement, under-26 mode, text search.
  Filter state lives in the URL — every view is shareable.
- **Museum detail pages** — plain-language explanation of every rule in your
  language, next free date, booking links, directions, sources with
  verification dates.
- **10 languages** — English, French, Spanish, Italian, German, Simplified and
  Traditional Chinese, Japanese, Korean, Arabic (full right-to-left layout).
  Museum names always shown with their French original.
- **PWA** — installable, works offline (app + data; map tiles for previously
  viewed areas), auto-updates.
- **Accessible** — keyboard operable throughout, screen-reader labels, list as
  the accessible equivalent of the map, `prefers-reduced-motion` respected,
  category colors validated for color-vision deficiency and never used alone.

## Data

| Source | What it provides | License |
|---|---|---|
| [parisjetaime.com](https://parisjetaime.com/article/les-musees-et-monuments-gratuits-a-paris-a961) | Free-admission categories for Paris museums & monuments | Facts, attributed |
| [data.gouv.fr — Liste des musées franciliens](https://www.data.gouv.fr/datasets/liste-des-musees-franciliens-idf) | Base directory: names, coordinates, addresses | Licence Ouverte |
| Official museum websites | Hand-curated free-admission rules for the rest of France | Facts, per-rule source URL |

Every rule in [`data/fr/museums.json`](data/fr/museums.json) carries the source
URL it was verified against and the date it was last checked. Variable-date
events (Museum Night, Heritage Days) use officially confirmed dates from
[`data/fr/events.json`](data/fr/events.json), with clearly-flagged estimates
beyond.

**Refreshing:** `npm run update-data` re-scrapes the parisjetaime article and
updates only the rules that came from it (hand-curated rules are never
touched), printing a reviewable diff. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#refreshing-the-data).

> Free-admission conditions change — always check the museum's official
> website before travelling.

## Development

```bash
npm install       # also copies the RTL text plugin into public/vendor/
npm run dev       # http://localhost:5173/free-museums-france/
npm run test      # vitest: rule engine, filters, scraper, dataset validation
npm run build     # typecheck + vite build + prerender (dist/)
npm run preview   # serve the production build
```

Requires Node 20+ (CI uses 24). No API keys — map tiles are served by
[OpenFreeMap](https://openfreemap.org/), free for production use.

### Project layout

```
data/              museums.json (canonical dataset) · events.json · aliases.json
                   overrides.json · i18n/museums.<locale>.json (descriptions)
src/lib/           freeRules.ts (date engine) · filters.ts · categories.ts …
src/components/    MapView · FilterPanel · CalendarView · DetailPanel …
src/locales/       UI strings, one file per locale
scripts/           update-parisjetaime.ts · prerender.ts · generate-icons.ts
tests/             vitest suites, incl. dataset & locale integrity checks
```

### Contributing translations or data

- UI strings: edit `src/locales/<locale>.json` (key parity with `en.json` is
  enforced by tests).
- Museum content: `data/i18n/museums.<locale>.json` — add a `name` only where
  an established localized name exists; the French original is always shown.
- Free-admission corrections: edit `data/museums.json` and include the official
  `source.url`; run `npm run test`.

## Deployment

Pushes to `main` test, build and deploy to
`travel-eu/travel-eu.github.io/free-museums-france/` via GitHub Actions — setup
in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Attribution

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors · Tiles by [OpenFreeMap](https://openfreemap.org/) ·
Museum directory from data.gouv.fr (Licence Ouverte) · Free-admission
information from parisjetaime.com and official museum websites · RTL text
rendering by [mapbox-gl-rtl-text](https://github.com/mapbox/mapbox-gl-rtl-text)
(BSD-2-Clause).

## License

[MIT](LICENSE)
