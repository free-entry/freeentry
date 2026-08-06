/** Generates PWA icons from an inline SVG mark. Run with `npm run icons`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = join(import.meta.dirname, '../public/icons');
mkdirSync(OUT, { recursive: true });

/** Museum front (pediment + columns), white on the app's plaque blue. */
function markSvg(padding: number): string {
  // padding is the fraction of the canvas left around the glyph (per side).
  const size = 24 / (1 - 2 * padding);
  const offset = (size - 24) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1D4E79"/>
  <g transform="translate(${offset} ${offset})">
    <path fill="#ffffff" d="M12 2 2 8v2h20V8L12 2zm-8 9h2.5v7H4v2h16v-2h-2.5v-7H20v-2H4v2zm4.5 0h2v7h-2v-7zm5 0h2v7h-2v-7z"/>
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
