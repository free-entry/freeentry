/**
 * Reports museums with no header image — the "no image" list for manual
 * sourcing (pin the result in scripts/enrich-images.ts's OVERRIDES). Always
 * exits 0: a missing image is expected for some museums (no Wikidata item,
 * no P18 claim, or no permissively-licensed photo), not a data-integrity
 * failure.
 *
 * Usage: npx tsx scripts/check-images.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const COUNTRY = process.env.COUNTRY ?? 'fr';
const MUSEUMS_PATH = join(ROOT, `data/${COUNTRY}/museums.json`);

function main() {
  const museums: Museum[] = JSON.parse(readFileSync(MUSEUMS_PATH, 'utf-8'));
  const withImage = museums.filter((m) => m.image);
  const without = museums.filter((m) => !m.image);

  console.log(`${withImage.length}/${museums.length} museums have a header image.`);
  if (without.length) {
    console.log('\nNo image — needs manual sourcing (see scripts/enrich-images.ts OVERRIDES):');
    for (const m of without) console.log(`  ? ${m.id} — ${m.name}`);
  }
}

main();
