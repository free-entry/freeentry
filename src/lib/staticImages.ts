import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import sharp from 'sharp';

export interface StaticImageMetadata {
  width: number;
  height: number;
}

const publicRoot = fileURLToPath(new URL('../../public', import.meta.url));
const metadataCache = new Map<string, Promise<StaticImageMetadata>>();

export function publicImagePath(file: string): string {
  const path = resolve(publicRoot, file);
  if (!path.startsWith(`${publicRoot}${sep}`)) throw new Error(`Invalid public image path: ${file}`);
  return path;
}

export function getStaticImageMetadata(file: string): Promise<StaticImageMetadata> {
  const cached = metadataCache.get(file);
  if (cached) return cached;
  const pending = sharp(publicImagePath(file)).metadata().then((metadata) => {
    const width = metadata.autoOrient?.width ?? metadata.width;
    const height = metadata.autoOrient?.height ?? metadata.height;
    if (!width || !height) throw new Error(`Could not read image dimensions: ${file}`);
    return { width, height };
  });
  metadataCache.set(file, pending);
  return pending;
}
