import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { stat } from 'node:fs/promises';
import sharp from 'sharp';
import { variantPath, variantWidths, type ImageVariant } from './imageVariants';

export interface StaticImageMetadata {
  width: number;
  height: number;
}

const publicRoot = fileURLToPath(new URL('../../public', import.meta.url));
const metadataCache = new Map<string, Promise<StaticImageMetadata>>();
const variantsCache = new Map<string, Promise<ImageVariant[]>>();

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

export function getStaticImageVariants(file: string): Promise<ImageVariant[]> {
  const cached = variantsCache.get(file);
  if (cached) return cached;
  const pending = getStaticImageMetadata(file).then(async ({ width: sourceWidth }) => {
    const variants = await Promise.all(
      variantWidths(sourceWidth).map(async (width): Promise<ImageVariant | null> => {
        const variantFile = variantPath(file, width);
        try {
          await stat(publicImagePath(variantFile));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw error;
        }
        const metadata = await sharp(publicImagePath(variantFile)).metadata();
        const realWidth = metadata.autoOrient?.width ?? metadata.width;
        if (!realWidth) throw new Error(`Could not read image width: ${variantFile}`);
        return { file: variantFile, width: realWidth };
      }),
    );
    return variants
      .filter((variant): variant is ImageVariant => variant !== null)
      .sort((a, b) => a.width - b.width);
  });
  variantsCache.set(file, pending);
  return pending;
}
