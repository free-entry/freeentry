import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import defaults from '../config/deployment.json';
import { variantPath, variantWidths } from '../src/lib/imageVariants';
import type { Museum } from '../src/lib/types';

const root = fileURLToPath(new URL('..', import.meta.url));
const siteDir = join(root, 'dist-site');
const imagesDir = join(root, 'dist-images');

function origin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error(`Expected a site origin, got ${value}`);
  }
  return url.origin;
}

const siteUrl = origin(process.env.PUBLIC_SITE_URL || defaults.siteUrl);
const imageBaseUrl = origin(process.env.PUBLIC_IMAGE_BASE_URL || defaults.imageBaseUrl);
const env = { ...process.env, PUBLIC_SITE_URL: siteUrl, PUBLIC_IMAGE_BASE_URL: imageBaseUrl };

function run(bin: string, args: string[], country?: string): void {
  const result = spawnSync(join(root, 'node_modules', '.bin', bin), args, {
    cwd: root,
    env: { ...env, ...(country ? { COUNTRY: country } : {}) },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${bin} ${args.join(' ')} failed (${result.status})`);
}

async function checkLimits(directory: string): Promise<void> {
  let count = 0;
  let bytes = 0;
  async function visit(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) {
        const { size } = await stat(file);
        if (size > 25 * 1024 * 1024) throw new Error(`Cloudflare Pages asset exceeds 25 MiB: ${file}`);
        count += 1;
        bytes += size;
      } else throw new Error(`Unsupported deployment entry: ${file}`);
    }
  }
  await visit(directory);
  if (count > 20_000) throw new Error(`Cloudflare Pages Free allows 20,000 files; ${directory} has ${count}`);
  console.log(`${directory}: ${count.toLocaleString()} files, ${(bytes / 1024 ** 2).toFixed(1)} MiB (within Pages Free limits).`);
}

async function main(): Promise<void> {
  run('astro', ['check']);
  await rm(siteDir, { recursive: true, force: true });
  await rm(imagesDir, { recursive: true, force: true });
  await mkdir(siteDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });

  // Keep the normal Astro outDir so PWA generation sees the correct app shell.
  // Each build is copied before Astro replaces dist/ for the next country.
  const originals = new Set<string>();
  for (const [country, path] of Object.entries(defaults.countries)) {
    run('tsx', ['scripts/build-image-variants.ts'], country);
    run('astro', ['build'], country);
    const dist = join(root, 'dist');
    await cp(dist, join(siteDir, path), {
      recursive: true,
      filter: (source) => source !== join(dist, 'images'),
    });
    const museums = JSON.parse(await readFile(join(root, 'data', country, 'museums.json'), 'utf8')) as Museum[];
    for (const museum of museums) if (museum.image) originals.add(museum.image.file);
  }

  for (const file of originals) {
    if (!/^images\/museums\/[a-z0-9-]+\.jpg$/.test(file)) throw new Error(`Unexpected image path: ${file}`);
    const source = resolve(root, 'public', file);
    const metadata = await sharp(source).metadata();
    const width = metadata.autoOrient?.width ?? metadata.width;
    if (!width) throw new Error(`Missing image width: ${file}`);
    for (const asset of [file, ...variantWidths(width).map((size) => variantPath(file, size))]) {
      const target = join(imagesDir, asset);
      await mkdir(dirname(target), { recursive: true });
      await cp(join(root, 'public', asset), target);
    }
  }

  for (const file of ['index.html', '404.html', 'robots.txt']) {
    const template = await readFile(join(root, 'site', file), 'utf8');
    await writeFile(join(siteDir, file), template.replaceAll('{{SITE_URL}}', siteUrl));
  }
  await writeFile(join(imagesDir, '_headers'), '/images/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=86400\n  X-Content-Type-Options: nosniff\n');
  await writeFile(join(imagesDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Free Entry images</title><a href="${siteUrl}/">Free Entry</a></html>\n`);
  await checkLimits(siteDir);
  await checkLimits(imagesDir);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
