import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { variantPath, variantWidths } from '../src/lib/imageVariants';
import type { Museum } from '../src/lib/types';

const startedAt = performance.now();
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = resolve(projectRoot, 'public');
const country = process.env.COUNTRY ?? 'fr';
const concurrency = 8;
let generated = 0;
let skipped = 0;

function printSummary(): void {
  const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Image variants (${country}): ${generated} generated, ${skipped} skipped in ${elapsedSeconds}s.`,
  );
}

function publicPath(file: string): string {
  const path = resolve(publicRoot, file);
  if (!path.startsWith(`${publicRoot}${sep}`)) throw new Error(`Invalid public image path: ${file}`);
  return path;
}

async function targetIsNewer(sourceMtimeMs: number, target: string): Promise<boolean> {
  try {
    return (await stat(target)).mtimeMs > sourceMtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function buildVariants(file: string): Promise<void> {
  const source = publicPath(file);
  const [metadata, sourceStat] = await Promise.all([sharp(source).metadata(), stat(source)]);
  const sourceWidth = metadata.autoOrient?.width ?? metadata.width;
  if (!sourceWidth) throw new Error(`Could not read image width: ${file}`);

  for (const width of variantWidths(sourceWidth)) {
    const target = publicPath(variantPath(file, width));
    if (await targetIsNewer(sourceStat.mtimeMs, target)) {
      skipped += 1;
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(target);
    generated += 1;
  }
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<unknown[]> {
  let nextIndex = 0;
  const errors: unknown[] = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        try {
          await worker(item);
        } catch (error) {
          errors.push(error);
        }
      }
    }),
  );
  return errors;
}

async function main(): Promise<void> {
  const dataPath = resolve(projectRoot, 'data', country, 'museums.json');
  const museums = JSON.parse(await readFile(dataPath, 'utf8')) as Museum[];
  const files = [...new Set(museums.flatMap((museum) => (museum.image ? [museum.image.file] : [])))];
  const errors = await runPool(files, buildVariants);
  printSummary();
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  printSummary();
  console.error(error);
  process.exitCode = 1;
});
