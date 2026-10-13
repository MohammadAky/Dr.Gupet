import { describe, expect, it } from 'vitest';
import { landingImageSet } from './landing-image';

const campaignFiles = import.meta.glob<string>('../../public/brand/landing-*.webp', {
  query: '?inline', import: 'default', eager: true,
});

describe('versioned campaign responsive images', () => {
  it('selects derivatives of the same mobile crop and preserves available desktop resolutions', () => {
    expect(landingImageSet('/brand/landing-family-mobile.webp')).toBe('/brand/landing-family-mobile-480.webp 480w, /brand/landing-family-mobile-720.webp 720w');
    expect(landingImageSet('/brand/landing-meal-1600.webp')).toBe('/brand/landing-meal-640.webp 640w, /brand/landing-meal-1600.webp 1600w');
  });
  it('supports validated same-origin API image URLs without rewriting external or customized resources', () => {
    const origin = 'https://drgupet.ir';
    expect(landingImageSet(`${origin}/brand/landing-treat-mobile.webp`, origin)).toContain('mobile-480.webp 480w');
    for (const source of ['/uploads/custom.webp', '/brand/mobile.webp', '/brand/landing-family-mobile.webp?version=2', 'https://other.example/brand/landing-family-mobile.webp', `${origin}/brand/landing-family-mobile.webp?version=2`, `https://user:password@drgupet.ir/brand/landing-family-mobile.webp`, 'blob:https://drgupet.ir/object']) {
      expect(landingImageSet(source, origin)).toBeUndefined();
    }
  });
  it('ships real WebP files for every responsive source exposed by the default campaigns', () => {
    for (const kind of ['family', 'meal', 'treat']) {
      for (const suffix of ['mobile', '1600']) {
        for (const candidate of landingImageSet(`/brand/landing-${kind}-${suffix}.webp`)!.split(', ')) {
          const path = candidate.split(' ')[0]!;
          const encoded = campaignFiles[`../../public${path}`];
          expect(encoded).toMatch(/^data:image\/webp;base64,/);
          const bytes = atob(encoded!.split(',')[1]!);
          expect(bytes.slice(0, 4)).toBe('RIFF');
          expect(bytes.slice(8, 12)).toBe('WEBP');
        }
      }
    }
  });
});
