# TODO

## Retiring the `free-museums-paris` sibling — done

The sibling's 134 Île-de-France venues have been fully reconciled into `data/fr/`:
20 venues it had and this repo didn't were merged in, 25 name aliases record the
crosswalk, and every dimension it modelled that `Museum` could not now has a home
here. Nothing in the sibling is still the sole copy of anything, and no script
reads from it.

**`free-museums-paris` was deleted on 2026-08-30.** The table below is the record
of what came across; the sibling is no longer available to re-check against.

| Dimension | Coverage | Status |
|---|---|---|
| Audience rules beyond under-26/18/residents | 106 rules | `Audience` widened to 13 values; backfilled |
| Rule `scope` | 20 rules | `FreeRule.scope` added; backfilled |
| `closures[]` | 36 venues / 87 windows | added, wired into the UI |
| `closedUntil` | 4 venues | added |
| `wheelchair` | 32 venues | added |
| `admission` | 24 venues | added |
| Human-verified `openingHours` | 128 venues | baked in; `import-opening-hours.ts` deleted |

Design decisions taken along the way, in case they need revisiting:

- **Visitor status is claimed, not assumed.** `filters.audiences` is a collapsed
  multi-select; an audience rule counts as free *for this visitor* only when they
  claimed that audience. Claiming under-26-EU also satisfies plain under-26, and
  under-18 satisfies under-26 (but not the EU-restricted variant, since
  nationality is unknown). With nothing claimed — the default — no audience rule
  counts, so a traveller is never told a concession-only day is free for them.
- **One marker for all concessions.** `categories.ts` maps the eight new
  audiences onto a single `concession-only` category rather than eight. A colour
  per concession would overload the map; the detail panel names the exact
  audience.
- **`isFreeOn` and `isClosedOn` stay separate.** Free and open are different
  facts and the upstream sources conflate them. A closure never turns a free day
  into a not-free one; the UI says "free today — but closed" instead. There is a
  test pinning this.

---

## Open work

### 1. The new dimensions are France-only

`Museum` and `FreeRule` now carry `wheelchair`, `admission`, `closures`,
`closedUntil` and `scope`, and `Audience` has thirteen values — but only
`data/fr/` uses any of it. Italy and Belgium are untouched:

| | venues | wheelchair | admission | closures | scope | audiences present |
|---|---|---|---|---|---|---|
| it | 370 | 0 | 0 | 0 | 0 | `under-18` only |
| be | 210 | 0 | 0 | 0 | 0 | `residents` only |

Nothing is broken — every field is optional — but an Italian or Belgian venue
that is free only for students, or shut for August, currently cannot say so. The
source builders (`scripts/sources/it/`, `scripts/sources/be/`) would need to
start emitting these fields.

### 2. Reconsider the venues on the skip list

`data/fr/overrides.json` skips four entries, two of them because they are closed
for years:

```
"Sèvres - Manufacture et musées nationaux"
"2025-2030 : le Centre Pompidou se métamorphose"
```

They were excluded when there was no way to say "everyone lists this as free, but
it is shut until 2030" — a venue with no free rules and no closure model is just
noise. `closedUntil` now expresses exactly that. Worth deciding whether these two
should come back as entries carrying `closedUntil: "2030"` rather than being
hidden, since a visitor who read elsewhere that the Pompidou is free on the first
Sunday is precisely the person this app should be correcting.

(The other two, Pierrefonds and Compiègne, are skipped for a different reason —
check the source article before touching them.)

### 3. 98 venues have no header photo

Wikimedia has no P18 for most of them; a few were rejected on licence. The path
for these is the `OVERRIDES` map in `scripts/enrich-images.ts`, fed by the
"no image" report from `npm run check:images`. Not urgent — the detail page
renders fine without one. Since the SEO pass these venues also fall back
to the app icon as `og:image` / `twitter:image`, so a real photo now improves
their social previews and image-search presence as well.

### 4. `musee-daubigny` — which address is current?

The now-deleted sibling had it at "Maison de l'Isle, rue Marcel Martin"; this
repo has "Manoir des Colombières, rue de la Sansonne", 0.89 km away. BAN agrees
with the address stored here, so the coordinates are self-consistent, but one of
the two records was out of date — the museum may have moved. The sibling's
verified opening hours were deliberately not transferred until someone confirms
which site is right, which now means checking the museum's own site rather than
comparing the two records.

### 5. Two sibling fields were not carried over

Deliberate, but worth a second opinion rather than being quietly forgotten:

- **`shortDescription`** (fr + en, one sentence per venue). This repo has only the
  full `description`, which map popups and list rows have to truncate. Carrying it
  would mean a new field plus a sentence per venue in ten locales.
- **`confidence`** (`verified` / `likely` / `unverified`). Every rule already
  carries a source URL and a `checkedAt` date, which is the stronger signal, so
  this looked redundant.

### 6. Publishing and final domain

- [x] Create the public `free-entry/freeentry` GitHub repository.
- [x] Add Cloudflare Pages packaging with separate website and image outputs.
- [x] Check the free file-count and per-file-size limits before publication.
- [x] Supply root navigation, 404 and robots.txt via `site/` templates.
- [ ] Verify the first automatic deployment in GitHub Actions.
- [ ] Wait for approval of the `freeentry.eu.org` application; then configure
      Cloudflare DNS, bind the Pages custom domain and set `PUBLIC_SITE_URL`.
- [ ] Verify the final domain in Google Search Console and Bing Webmaster
      Tools and submit the three country sitemap indexes.
- [ ] Add the locale-routing browser smoke test to CI.

The temporary origin is `https://freeentry-eu.pages.dev`; deployment instructions
and domain migration steps are in `docs/DEPLOYMENT.md`.

---

## Other

- No confirmed Museum Night / Heritage Days dates for 2027 yet — `check:freshness`
  warns about this until the official announcements land.
- `concession-only` has no venue-level occurrences yet: every venue with a
  concession rule also has a broader one, so the category only ever appears on a
  per-rule badge. If a venue ever becomes free *only* for, say, ICOM cardholders,
  check the marker and legend read well before assuming it works.
