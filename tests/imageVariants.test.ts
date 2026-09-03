import { describe, expect, it } from 'vitest';
import { buildSrcSet, VARIANT_WIDTHS, variantPath } from '@/lib/imageVariants';

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
