// Copies the RTL text plugin's dist build (hidden behind the package's
// exports map) into public/vendor/ so MapLibre can load it by URL.
// Runs on postinstall; public/vendor/ is gitignored.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js');
const dest = join(root, 'public/vendor/mapbox-gl-rtl-text.js');
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('Copied mapbox-gl-rtl-text.js to public/vendor/');
