/** Generates PWA icons from an inline SVG mark. Run with `npm run icons`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = join(import.meta.dirname, '../public/icons');
mkdirSync(OUT, { recursive: true });

/** Eiffel Tower silhouette (same glyph as the header wordmark), white on the
 *  app's sunny poster blue. */
function markSvg(padding: number): string {
  // padding is the fraction of the canvas left around the glyph (per side).
  const size = 32 / (1 - 2 * padding);
  const offset = (size - 32) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1266D3"/>
  <g transform="translate(${offset} ${offset})" fill="#ffffff">
    <path d="M15.25 7.2 15.62 2.5C15.7 1.95 16.3 1.95 16.38 2.5L16.75 7.2Z"/>
    <rect x="14.5" y="5.1" width="3" height="2.1" rx=".45"/>
    <path d="M16.85 7.2c.25 3.4.65 6.4 1.75 9.05h-5.2c1.1-2.65 1.5-5.65 1.75-9.05Z"/>
    <rect x="12.1" y="16.15" width="7.8" height="2.05" rx=".35"/>
    <path d="M12.5 18.2h7l1.8 3.8h-3.65l-.35-3.3h-2.6l-.35 3.3H10.7Z"/>
    <rect x="9.45" y="21.95" width="13.1" height="2.05" rx=".35"/>
    <path d="M10.13 24h11.74L26 30h-5.8a4.2 4.4 0 0 0-8.4 0H6Z"/>
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
