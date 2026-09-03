# Deployment

The app is a fully static build served by GitHub Pages at
`https://freeentry.org/free-museums-france` (the custom domain sits on the
`travel-eu/travel-eu.github.io` site, so every project page serves under it;
the old `travel-eu.github.io` URLs 301-redirect once the domain is configured).

Two repositories are involved:

| Repository | Role |
|---|---|
| `travel-eu/free-museums-france` | Source code + CI. Every push to `main` tests, builds and deploys. |
| `travel-eu/travel-eu.github.io` | The GitHub Pages site. The build lands in its `free-museums-france/` directory. |

## One-time setup

1. **Create the organization** `travel-eu` on GitHub (Settings → Organizations →
   New organization), if it does not exist yet.

2. **Create the Pages repository** `travel-eu/travel-eu.github.io` (public).
   Add any placeholder `index.html` at its root and enable GitHub Pages:
   repo Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.

3. **Create the source repository** `travel-eu/free-museums-france` (public) and
   push this project:

   ```bash
   git remote add origin git@github.com:travel-eu/free-museums-france.git
   git push -u origin main
   ```

4. **Create the deploy token.** GitHub → Settings (your profile or the org) →
   Developer settings → Personal access tokens → Fine-grained tokens → Generate:
   - Resource owner: `travel-eu`
   - Repository access: only `travel-eu/travel-eu.github.io`
   - Permissions: **Contents: Read and write**
   - Expiration: your choice (you will need to rotate it).

5. **Add the secret.** In `travel-eu/free-museums-france` → Settings → Secrets
   and variables → Actions → New repository secret:
   - Name: `DEPLOY_TOKEN`
   - Value: the token from step 4.

6. Push to `main` (or run the workflow manually via Actions → *Test, build and
   deploy* → Run workflow). The site appears at
   `https://travel-eu.github.io/free-museums-france/` after the Pages build.

Without the secret, CI still runs tests and builds (useful for forks and PRs) —
only the deploy step is skipped, with a notice in the log.

## Refreshing the data

Free-admission conditions change. Periodically run:

```bash
npm run update-data          # fetches parisjetaime.com, rewrites data/museums.json
npm run update-data -- --dry-run   # preview only
```

The script only touches rules whose provenance is parisjetaime.com; rules
curated from official museum sites are left untouched. Review the printed diff,
run `npm run test`, commit and push — CI redeploys automatically.

Once a year (usually early in the year), confirm the next editions of the
variable-date events and add them to `data/events.json`:

- Nuit européenne des musées — <https://nuitdesmusees.culture.gouv.fr>
- Journées européennes du patrimoine — <https://journeesdupatrimoine.culture.gouv.fr>

The update script warns when the coming year has no confirmed dates; until
then the app shows estimated dates flagged as such.

## Custom domain — freeentry.org

The canonical domain is `freeentry.org`, configured once on the Pages site
(not per project repo):

1. **DNS** (at the registrar): apex `A` records to GitHub Pages —
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   (and the matching `AAAA` records `2606:50c0:8000..8003::153`).
2. **Pages settings** of `travel-eu/travel-eu.github.io`: set the custom
   domain to `freeentry.org` and enable *Enforce HTTPS* once the Let's
   Encrypt certificate is issued. All project pages then serve under
   `https://freeentry.org/<repo>/`, and github.io URLs redirect.
3. **Root robots.txt** in `travel-eu/travel-eu.github.io` should list every
   deployment's sitemap (crawlers only read the domain root):

   ```
   User-agent: *
   Allow: /

   Sitemap: https://freeentry.org/free-museums-france/sitemap.xml
   Sitemap: https://freeentry.org/free-museums-italy/sitemap.xml
   Sitemap: https://freeentry.org/free-museums-belgium/sitemap.xml
   ```

If the domain ever changes, update `siteUrl` in `src/countries/*.ts` and the
`DEPLOYMENTS` map in `astro.config.mjs` (the per-country `robots.txt` route
follows `siteUrl` automatically).

## Umbrella 404 routing

GitHub Pages uses only the root `404.html` from
`travel-eu/travel-eu.github.io` for unknown URLs on `freeentry.org`. A
`404.html` emitted inside `free-museums-france/`, `free-museums-italy/`, or
`free-museums-belgium/` is not selected by Pages. Keep the umbrella 404 aware
of all three project base paths so an unknown museum or localized app URL can
boot the appropriate map shell.

## Search engine webmaster setup

Verify the domain property `freeentry.org` in both Google Search Console and
Bing Webmaster Tools. Domain-property verification covers all three country
paths. After verification, submit these sitemap index URLs in each service:

- `https://freeentry.org/free-museums-france/sitemap.xml`
- `https://freeentry.org/free-museums-italy/sitemap.xml`
- `https://freeentry.org/free-museums-belgium/sitemap.xml`

Each index links to ten locale sitemaps. Resubmit an index only when its URL
changes; search engines will revisit it and its locale sitemaps automatically.
