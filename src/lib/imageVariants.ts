export const VARIANT_WIDTHS = [480, 800, 1200] as const;

export interface ImageVariant {
  file: string;
  width: number;
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
