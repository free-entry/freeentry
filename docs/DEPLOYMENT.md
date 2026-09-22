# Deployment

Free Entry runs on two Cloudflare Pages Free projects, both deployed from
[`free-entry/freeentry`](https://github.com/free-entry/freeentry).

| Project | Address | Output |
|---|---|---|
| `freeentry` | `https://freeentry-bx9.pages.dev` | `dist-site/` |
| `freeentry-images` | `https://freeentry-images.pages.dev` | `dist-images/` |

Cloudflare assigned the main project a suffixed subdomain; its project name is
still `freeentry`. Use the actual subdomain above for canonical URLs.

The main site contains `/france/`, `/italy/` and `/belgium/`. English uses each
country root; other languages follow it, e.g. `/france/fr/`. The root homepage
redirects to France and links to every country. Static museum and directory
pages work on direct visits, and the root 404 page handles unknown paths.

## Automatic deployment

Pushes to `main` run tests and build all countries. GitHub Actions checks the
Pages Free limits (20,000 files per project, 25 MiB per file), publishes the
shared images, then publishes the website. Pull requests only test and build.
Manual runs deploy only when started from `main` in `free-entry/freeentry`.

Configure these repository settings under Settings → Secrets and variables → Actions:

| Type | Name | Value |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Account → Cloudflare Pages → Edit, restricted to the hosting account |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Hosting account ID |
| Variable (optional) | `PUBLIC_SITE_URL` | Override the main origin in `config/deployment.json` |
| Variable (optional) | `PUBLIC_IMAGE_BASE_URL` | Override the shared image origin |

The Pages projects use Direct Upload; GitHub Actions provides automatic
publication. No Cloudflare GitHub App installation or GitHub Pages setup is
needed. Keep the API token in GitHub Secrets, outside the repository.

## Local build and manual deployment

```bash
bun install --frozen-lockfile
bun run test
bun run build:pages
```

The build uses the regular Astro `dist/` directory for each country so the PWA
plugin writes the correct service worker. It assembles the country outputs in
`dist-site/`, excludes all museum photos from that site, and copies one copy of
each referenced JPEG and generated WebP to `dist-images/`. This stays below the
free file limit without dropping languages or museum pages. Every build checks
the final outputs and fails before publication if either limit is exceeded.

Development (`bun run dev`) and single-country builds use local photos. The
Pages build sets `PUBLIC_IMAGE_BASE_URL` for HTML images, responsive srcsets,
React details, Open Graph images and structured data. The image site sends CORS
headers, and the service worker can cache both JPEG and WebP museum photos.

The interactive homepage shows a map-shaped loading screen while JavaScript
loads; visitors without JavaScript receive the static museum directory.

## Switch to freeentry.eu.org after approval

1. Keep the EU.org delegation to HE DNS until the domain application is approved.
2. Add `freeentry.eu.org` to Cloudflare DNS and change its nameservers at EU.org
   to the exact pair Cloudflare assigns. Wait for the zone to become active.
3. Add `freeentry.eu.org` as a custom domain of the `freeentry` Pages project.
4. Set the repository variable `PUBLIC_SITE_URL` to `https://freeentry.eu.org`
   and rerun the workflow from `main`. Canonical, hreflang, Open Graph, JSON-LD
   and sitemap URLs will use that origin on the next build.
5. Optionally bind `images.freeentry.eu.org` to `freeentry-images`, then set
   `PUBLIC_IMAGE_BASE_URL` to `https://images.freeentry.eu.org` and rebuild.

Keep the Pages addresses working while DNS and certificates are being prepared.
The custom domain does not need to be registered before deploying the website.

## Search engines

After binding the final domain, verify it in Google Search Console and Bing
Webmaster Tools. Submit `/france/sitemap.xml`, `/italy/sitemap.xml` and
`/belgium/sitemap.xml`. The root `robots.txt` lists all three sitemap indexes.

## Refresh data

```bash
bun run update-data --dry-run
bun run update-data
bun run test
```

Review the data changes before committing and pushing. See
[DATA-UPDATE.md](DATA-UPDATE.md) for all country sources and maintenance steps.
