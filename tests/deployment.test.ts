import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageUrl } from '@/lib/deployment';
import { buildSrcSet } from '@/lib/imageVariants';
import { museumSeo } from '@/lib/seo';
import { createStaticI18n } from '@/lib/staticData';
import museums from '../data/fr/museums.json';
import type { Museum } from '@/lib/types';

afterEach(() => vi.unstubAllEnvs());

describe('shared image hosting', () => {
  it('keeps single-country development images local', () => {
    expect(imageUrl('/images/museums/example.jpg', '/france/', '')).toBe('/france/images/museums/example.jpg');
  });

  it('uses the same remote origin for originals, srcset and structured data', () => {
    vi.stubEnv('PUBLIC_IMAGE_BASE_URL', 'https://images.example.com/');
    const museum = museums.find((item) => item.image) as Museum;
    expect(imageUrl(museum.image!.file, '/france/')).toBe(`https://images.example.com/${museum.image!.file}`);
    expect(buildSrcSet('/france/', [{ file: 'images/derived/example-800.webp', width: 800 }]))
      .toBe('https://images.example.com/images/derived/example-800.webp 800w');
    const i18n = createStaticI18n('en');
    expect(museumSeo(museum, undefined, 'en', i18n.t.bind(i18n)).jsonLd[0].image)
      .toBe(`https://images.example.com/${museum.image!.file}`);
  });
});
