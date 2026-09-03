export const VARIANT_WIDTHS = [480, 800, 1200] as const;

export interface ImageVariant {
  file: string;
  width: number;
}

/**
 * Widths to generate for a source of the given width: every standard width
 * the source can serve without upscaling, plus the source's own width when
 * it is narrower than the largest standard width, so the srcset always ends
 * with a full-resolution WebP and never repeats a width.
 */
export function variantWidths(sourceWidth: number): number[] {
  const largest = VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];
  const widths: number[] = VARIANT_WIDTHS.filter((width) => width <= sourceWidth);
  if (sourceWidth < largest && !widths.includes(sourceWidth)) widths.push(sourceWidth);
  return widths;
}

export function variantPath(file: string, width: number): string {
  const filename = file.slice(file.lastIndexOf('/') + 1);
  const extensionIndex = filename.lastIndexOf('.');
  const basename = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
  return `images/derived/${basename}-${width}.webp`;
}

export function buildSrcSet(baseUrl: string, variants: ImageVariant[]): string {
  return variants.map(({ file, width }) => `${baseUrl}${file} ${width}w`).join(', ');
}
