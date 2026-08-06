# Deployment

The app is a fully static build served by GitHub Pages at
`https://travel-eu.github.io/free-museums-france`.

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

## Custom domain (optional)

Point a CNAME at `travel-eu.github.io` and configure it in the Pages settings
of `travel-eu/travel-eu.github.io`. Update `SITE` in `scripts/prerender.ts`,
`Sitemap:` in `public/robots.txt`, and the `base` in `vite.config.ts` if the
app moves to the domain root.
