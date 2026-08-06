# Wikidata-sourced museum header images

Date: 2026-08-06. Status: design approved by user in chat; spec written up for record and to hand off to implementation planning.

## Goals

1. The detail page (`DetailPanel`) header shows a background photo of the
   museum, sourced from its Wikidata item's image (P18), when one is
   available under a permissive license.
2. Museums with no usable image keep today's flat "gallery wall label"
   header unchanged — no generic placeholder graphic (explicitly rejected).
3. Images are downloaded and self-hosted in the repo, not hotlinked live
   from Wikimedia Commons — the header must keep working offline in the PWA
   and must not depend on a third-party host at runtime.
4. Every stored image carries attribution metadata (author, license, source
   URL) and the UI shows a small credit line.
5. The user will manually source images for museums the pipeline can't
   cover; a manual pin must survive future automated re-runs.
6. `MuseumCard` (the list row) is explicitly out of scope this round — the
   list stays text-only; a card redesign would be a separate future spec.

## Coverage reality check

Not all 145 museums qualify, contrary to the initial assumption that "every
venue has a French Wikipedia page":

- 142/145 have a `wikidata` QID.
- 128/145 have `wikipediaFr`; all 128 are a subset of the 142 with `wikidata`.
- 3 have neither (`europa-experience`, `musee-de-la-grande-loge-de-france`,
  `tours-de-notre-dame-de-paris` — already marked `null` in
  `enrich-wikidata.ts`'s `OVERRIDES`).

Even among the 142 with a Wikidata item, P18 (image) is an optional
property, and even when present the license may not be one we're willing to
redistribute. So the "no image" set is expected to be larger than 3, and the
design (goal 2) treats that as normal, not an error state.

## Design

### New script: `scripts/enrich-images.ts`

Runs after `enrich-wikidata.ts` in the pipeline (depends on `museum.wikidata`
already being set). For each museum with a QID and no existing `image` (and
not `--force`):

1. Fetch the Wikidata entity's P18 claim (Commons filename).
2. Resolve file metadata via the Commons API
   (`action=query&prop=imageinfo&iiprop=url|extmetadata`): direct file URL,
   `extmetadata.LicenseShortName`, `extmetadata.Artist`, and the file's
   Commons page URL.
3. License allow-list: CC0, Public Domain, CC-BY (any version), CC-BY-SA
   (any version). Anything else, or metadata that doesn't parse, is
   skipped — the museum lands in the "no image" report for manual
   follow-up. No fair-use / non-free images are ever accepted.
4. Download the accepted file, resize to a max 1200px long edge, re-encode
   as JPEG quality ~78 (target: well under 150KB/file), write to
   `public/images/museums/<museum-id>.jpg`.
5. Write to `data/museums.json`:
   ```
   museum.image = {
     file: "images/museums/<id>.jpg",
     author: "...",
     license: "CC BY-SA 4.0",
     sourceUrl: "https://commons.wikimedia.org/wiki/File:...",
     wikimediaFile: "File:....jpg",
   }
   ```

**Manual overrides**: an `OVERRIDES`-style map (same pattern as
`enrich-wikidata.ts`), keyed by museum id, supporting two shapes:

- `{ wikimediaFile: "File:Xxx.jpg" }` — pin a specific Commons file instead
  of whatever P18 currently points to; still runs through the
  license/metadata/resize pipeline.
- `{ url, author, license, sourceUrl }` — a fully manual, non-Wikimedia
  image the user found and vetted themselves; the script downloads directly
  from `url` and skips the Commons lookup, still applies the same
  resize/re-encode step.

An existing `museum.image` is **never** overwritten by a normal run, only by
an explicit `--force`, so both automated and hand-pinned entries survive
repeat runs of the pipeline (mirrors `enrich-wikidata.ts`'s existing
`if (museum.wikidata && !force) continue;` behavior).

### New check script: `scripts/check-images.ts`

Reports museums with no `image` field — this is the "no image" list handed
to the user for manual sourcing. Mirrors `check-wikidata.ts` /
`check-datagouv.ts` in structure and is wired into `check:data` and
`update:all`.

### Types (`src/lib/types.ts`)

```ts
interface MuseumImage {
  file: string; // path relative to /public, e.g. "images/museums/arc-de-triomphe.jpg"
  author: string;
  license: string; // e.g. "CC BY-SA 4.0"
  sourceUrl: string; // Commons file page, or user-supplied source
  wikimediaFile?: string; // "File:Xxx.jpg" when sourced from Commons
}
```

`Museum` gains an optional `image?: MuseumImage`.

### UI (`DetailPanel.tsx` / `DetailPanel.module.css`)

- When `museum.image` is set, the header gets
  `background-image: url(<BASE_URL><image.file>)`,
  `background-size: cover`, `background-position: center`, replacing the
  flat background color for that header only.
- A dark gradient scrim (`linear-gradient(to top, rgba(0,0,0,.65), rgba(0,0,0,.1) 60%)`)
  sits between the photo and the text so the existing eyebrow/name/badge
  text stays legible over any photo, in both light and dark theme. The
  colored left-border accent is dropped when a photo is present (the scrim
  already carries the visual weight); it stays as today when there's no
  image.
- The header gets a minimum block-size (~180px) only when a photo is
  present, so the photo reads as a banner rather than a thin sliver behind
  two lines of text; headers with no photo keep their current
  content-driven height.
- No image: header renders exactly as it does today — zero visual change
  for the ~30–45% of museums without one.
- A small credit line sits in the header's bottom-right corner:
  `Photo: {{author}} · {{license}}`, linking to `sourceUrl`. New i18n key
  `museum.photoCredit`, added to all 10 locales.

### Testing

- `tests/data.test.ts`: when `museum.image` is set, every field is a
  non-empty string, `license` is one of the allow-listed values, and `file`
  resolves to a file that actually exists under `public/images/museums/`.
- Manual: dev-server screenshot pass over one museum with an image and one
  without, in both light and dark theme.

### Out of scope this round

- `MuseumCard` (list row) images.
- Any placeholder/generic image for museums with no usable photo.
