# Data update runbook

All venue data lives in `data/<country>/` (`fr`, `it`, `be`) with per-fact
provenance: every free-admission rule carries `source.url` +
`source.checkedAt`, opening hours carry `openingHoursSource`, identity links
carry `wikidata` / `museofile` ids.
The re-verification interval is **365 days** — `npm run check:freshness` (and
the monthly *Data freshness* workflow) turns red when anything exceeds it.

Country-generic scripts read the `COUNTRY` env var (default `fr`):
`COUNTRY=it npm run check:freshness`, `COUNTRY=be npm run update:images`, …
France-specific pipelines (parisjetaime, data.gouv register, CMN, P1 hours
import) are pinned to `data/fr` and ignore `COUNTRY`.

Two kinds of maintenance:

1. **The deterministic pipeline (no AI)** — safe to run at any time, as often
   as you like. `check:*` commands are read-only reporters; `update:*`
   commands write only with their documented flags and are all re-runnable.
2. **The AI-assisted tasks** — everything that needs research or translation.
   Copy the prompt at the bottom of this file into an AI agent session.

## Deterministic pipeline

| Command | What it does | Writes? |
|---|---|---|
| `npm run check:freshness` | Flags rules/hours older than 365 days, missing event years | no |
| `npm run check:wikidata` | Outside opinion from Wikidata: dead/redirected QIDs, coordinate disagreement > 0.6 km, French-Wikipedia article drift | `--write` refreshes links |
| `npm run check:datagouv` | Diffs the official museum register: new museums, field drift, identity (museofile) links | `--write` stores museofile ids |
| `npm run check:osm-hours` | Compares our opening hours against OpenStreetMap | no |
| `npm run check:cmn` | Diffs the official Centre des monuments nationaux list: new monuments, delisted venues | no |
| `npm run check:data` | freshness + wikidata + datagouv + cmn in one go | no |
| `npm run update:rules` | Re-scrapes parisjetaime.com free-admission rules (only replaces rules from that source; `--dry-run` supported) | yes |
| `npm run update:wikidata` | Links any museum still missing a QID (verified matching; `--dry-run`) | yes |
| `npm run update:hours` | Re-imports verified hours from a `../free-museums-paris` checkout (`--dry-run`, `--p1 <path>`) | yes |
| `npm run update:all` | rules → wikidata → link refresh → museofile ids → freshness report | yes |
| `npx tsx scripts/build-cmn.ts --out <staging>` | Bootstrap resolver for new CMN monuments (Wikidata identity via official-site domain, BAN reverse geocoding, department cross-check) — feeds the AI verification pass | staging file only |
| `npx tsx scripts/sources/it/build-domenicalmuseo.ts` | Italy: resolves the Domenica al Museo venue list (fixture `scripts/fixtures/it/domenicalmuseo.json`) against Wikidata + Nominatim and rebuilds `data/it/museums.json` rules (first Sunday, national free days, under-18). Incremental — re-running only touches unresolved venues | yes (`data/it`) |
| `npx tsx scripts/sources/be/build-be.ts` | Belgium: pools the Brussels/FWB first-Sunday networks, Ghent/Antwerp resident schemes and always-free museums (fixture `scripts/fixtures/be/free-museums.json`), resolves against Wikidata with photon address fallback, rebuilds `data/be/museums.json`. Incremental | yes (`data/be`) |

Yearly sequence (what the *Data update* workflow runs): `update:all`, then
`check:osm-hours`, then `npm test`. It opens a PR — **a green run means the
data is valid, not that it is right**; read the diff against the cited
sources before merging.

Principles the scripts encode (borrowed from the sibling `free-museums-paris`
audit):

- **Identity over names.** Joins use QID / museofile / parisjetaime record
  ids. Name matching is a last resort and always distance-guarded — a name
  match plotted in another town is a report, not a match.
- **Disagreement needs a third opinion.** When our coordinates and Wikidata
  disagree, geocode the street address with BAN
  (`https://api-adresse.data.gouv.fr/search/?q=<address>`) and see which side
  it lands on. Human-arbitrated cases are recorded in `ACKNOWLEDGED_COORDS`
  (scripts/check-wikidata.ts) so they don't cry wolf forever.
- **Report, don't trust, external sources.** The register and OSM are
  references; both have shipped stale points and stale hours. Every automated
  write is either identity-verified (QIDs, museofile) or scoped to a single
  source's own facts (parisjetaime rules).

## Scheduled automation

- **Data update** (`.github/workflows/data-update.yml`) — yearly cron
  (July 15) + manual trigger with a stage picker (`all`, `rules`, `wikidata`,
  `datagouv`, `osm-hours`, `freshness`). Opens a PR when data changed; the
  full console report is attached as a run artifact.
- **Data freshness** (`.github/workflows/data-freshness.yml`) — monthly cron +
  manual. Quiet until something passes the 365-day limit, then fails so
  GitHub notifies you.

## AI-assisted updates

Everything below needs judgment, research on official sites, or translation —
paste this prompt into an AI agent session (Claude Code or similar) with this
repository checked out. Translation and translation review must run on
Opus/Sonnet-class models, not be improvised.

```text
You are updating the data of the free-museums monorepo (maps of free museums
in France, Italy and Belgium — data/fr, data/it, data/be). Read
docs/DATA-UPDATE.md first. Work in small, reviewable diffs; run `npm test`
after every change; never mark something verified you did not actually
verify. Steps 1–4 are France; steps 6–7 are Italy and Belgium — run
check:freshness for those countries with COUNTRY=it / COUNTRY=be.

1. TRIAGE THE DETERMINISTIC REPORTS
   Run: npm run check:data && npm run check:osm-hours
   - For every stale rule (check:freshness): open the rule's source.url,
     confirm or correct the rule, and set source.checkedAt to today's date —
     only if you actually read the page. If the source is gone, find the
     museum's official page, update source.url, re-verify.
   - For hours that differ from OSM or are stale: the museum's official
     website wins. Update openingHours (restricted OSM syntax, e.g.
     "Tu-Su 10:00-18:00; PH off") and openingHoursSource {url, checkedAt}.
   - For coordinate disagreements: arbitrate with BAN address geocoding as
     the third opinion; fix data/museums.json or add an entry to
     ACKNOWLEDGED_COORDS in scripts/check-wikidata.ts with the reason.
   - For register candidates ("without a counterpart"): decide add / alias /
     ignore. Closed venues (e.g. musée Hébert) and never-free venues are
     "ignore" — note why in the PR description.

2. EVENT DATES (yearly)
   Confirm next year's Nuit des musées and Journées européennes du
   patrimoine dates from the official announcements
   (nuitdesmusees.culture.gouv.fr, journeesdupatrimoine.culture.gouv.fr)
   and add them to data/events.json under confirmed.<year>. Never infer
   dates from a previous edition.

3. NEW MUSEUMS (after adding a record to data/museums.json)
   A new museum needs, before tests pass:
   - freeAccess rules with per-rule source.url + checkedAt (verified today)
   - a French-language canonical name in museums.json (accents on capitals)
   - descriptions in ALL 10 locales (data/i18n/museums.<locale>.json) and a
     localized "name" in the 9 non-French locales. Match the style of
     existing entries. Translation and its review must be done by
     Opus/Sonnet-class models; give each locale's translator the existing
     entries as style reference, then run an independent review pass.
   - run: npm run update:wikidata && npm run check:datagouv -- --write
     to link its QID and museofile id.

4. CMN MONUMENTS (yearly)
   Run: npm run check:cmn
   - For every monument venue already in the dataset: open the free rule's
     source page (the monument's own tarifs page), re-confirm the winter
     first-Sunday months and any always-free/other schemes, bump checkedAt.
     The under-26 EU rule cites
     tickets.monuments-nationaux.fr/fr-FR/conditions-de-gratuite — re-read
     that page once per year and bump every rule citing it.
   - For monuments new on the official list: run build-cmn to resolve
     identity, then verify the new site's own tarifs page before writing
     rules; every new venue then needs the full step-3 content treatment.
   - For venues gone from the list: check the site for closure or transfer
     out of CMN management, and update status/note accordingly.

5. FINISH (per country)
   npm test && npm run build (and build:it / build:be) must pass. Summarize
   per museum: what changed, which source confirmed it, and anything you
   could not verify (say so plainly rather than guessing).

6. ITALY (yearly)
   - Re-read https://cultura.gov.it/domenicalmuseo (via the Wayback Machine
     if the site blocks your network) and confirm Domenica al Museo is still
     running; bump checkedAt on every rule citing it.
   - Re-read the national free-days page
     (https://cultura.gov.it/agevolazioni) — confirm 25 April / 2 June /
     4 November and the under-18 rule; bump their checkedAt.
   - Re-fetch the participating-venues list. New venues: add to
     scripts/fixtures/it/domenicalmuseo.json, run build-domenicalmuseo
     (incremental), manually verify any venue the resolver leaves without a
     QID, then give each the full step-3 content treatment (10 locales).
     Vanished venues: check the venue's own page before removing — regional
     lists fluctuate; only remove on positive evidence.

7. BELGIUM (yearly)
   - Brussels network: re-read https://www.brusselsmuseums.be/en/free-museums
     — membership changes yearly. FWB/Wallonia network: re-read
     https://artsetpublics.be/programmes/musees-gratuits/.
   - City schemes: Ghent (degentsemusea.be — Late Donderdag pauses in
     July/August, resident first Sundays), Antwerp (A-kaart first Tuesdays,
     pers.antwerpen.be tariff announcements). These are RESIDENT-ONLY —
     audience: "residents" — and must never gain a general-audience rule
     without a source saying so.
   - Always-free museums: spot-check each venue's own tickets page.
   - Membership changes: update scripts/fixtures/be/free-museums.json, run
     build-be (incremental), then full content treatment for new venues.
```
