import { describe, expect, it } from 'vitest';
import { buildSrcSet, VARIANT_WIDTHS, variantPath, variantWidths } from '@/lib/imageVariants';

describe('image variants', () => {
  it('defines the generated widths and builds a derived WebP path', () => {
    expect(VARIANT_WIDTHS).toEqual([480, 800, 1200]);
    expect(variantPath('images/museums/49-nord-6-est-frac-lorraine.jpg', 480)).toBe(
      'images/derived/49-nord-6-est-frac-lorraine-480.webp',
    );
  });

  it('builds a width-descriptor srcset using the deployment base URL', () => {
    expect(
      buildSrcSet('/free-museums-france/', [
        { file: 'images/derived/example-480.webp', width: 480 },
        { file: 'images/derived/example-720.webp', width: 720 },
      ]),
    ).toBe(
      '/free-museums-france/images/derived/example-480.webp 480w, /free-museums-france/images/derived/example-720.webp 720w',
    );
  });
});

describe('variantWidths', () => {
  it('serves every standard width the source covers, including its own', () => {
    expect(variantWidths(1200)).toEqual([480, 800, 1200]);
    expect(variantWidths(2000)).toEqual([480, 800, 1200]);
  });

  it('ends with the source width for narrower photos, without repeating it', () => {
    expect(variantWidths(720)).toEqual([480, 720]);
    expect(variantWidths(800)).toEqual([480, 800]);
    expect(variantWidths(375)).toEqual([375]);
  });
});
