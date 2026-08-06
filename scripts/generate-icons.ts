/** Generates PWA icons from an inline SVG mark. Run with `npm run icons`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { COUNTRY_MARKS } from '../src/countries/marks';

const COUNTRY = process.env.COUNTRY ?? 'fr';
const OUT = join(import.meta.dirname, COUNTRY === 'fr' ? '../public/icons' : `../public/icons-${COUNTRY}`);
mkdirSync(OUT, { recursive: true });

/** Country landmark silhouette (same glyph as the header wordmark), white on
 *  the app's sunny poster blue. */
function markSvg(padding: number): string {
  // padding is the fraction of the canvas left around the glyph (per side).
  const size = 32 / (1 - 2 * padding);
  const offset = (size - 32) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1266D3"/>
  <g transform="translate(${offset} ${offset})" fill="#ffffff">${COUNTRY_MARKS[COUNTRY] ?? COUNTRY_MARKS.fr}
  </g>
</svg>`;
}

async function render(svg: string, size: number, file: string): Promise<void> {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, file));
  console.log(`icons/${file}`);
}

// Regular icons: modest padding. Maskable: 20% safe zone per side.
const regular = markSvg(0.16);
const maskable = markSvg(0.24);

await render(regular, 192, 'icon-192.png');
await render(regular, 512, 'icon-512.png');
await render(maskable, 512, 'icon-maskable-512.png');
await render(regular, 180, 'apple-touch-icon.png');
writeFileSync(join(OUT, 'icon.svg'), regular);
console.log('icons/icon.svg');
