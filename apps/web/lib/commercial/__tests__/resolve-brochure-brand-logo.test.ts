import { describe, expect, it } from 'vitest';

import {
  resolveBrochureBrandLogo,
  resolveBrochurePlateLogo,
} from '~/lib/commercial/public-brochure.shared';

const brand = {
  logoUrl: 'https://cdn.example.com/primary.png',
  logoOnLightUrl: 'https://cdn.example.com/on-light.png',
  logoOnDarkUrl: 'https://cdn.example.com/on-dark.png',
  primaryColor: '#0D2344',
  secondaryColor: '#FFFFFF',
  accentColor: '#C8102E',
};

describe('resolveBrochurePlateLogo', () => {
  it('uses on_dark for a navy cover / contact plate', () => {
    expect(resolveBrochurePlateLogo(brand)).toBe(brand.logoOnDarkUrl);
  });

  it('falls back to the primary logo when on_dark is missing', () => {
    expect(
      resolveBrochurePlateLogo({
        ...brand,
        logoOnDarkUrl: null,
      }),
    ).toBe(brand.logoUrl);
  });

  it('uses on_light on a pale brand plate', () => {
    expect(
      resolveBrochurePlateLogo({
        ...brand,
        primaryColor: '#FBF6EC',
      }),
    ).toBe(brand.logoOnLightUrl);
  });
});

describe('resolveBrochureBrandLogo', () => {
  it('picks the requested surface variant', () => {
    expect(resolveBrochureBrandLogo(brand, 'light')).toBe(brand.logoOnLightUrl);
    expect(resolveBrochureBrandLogo(brand, 'dark')).toBe(brand.logoOnDarkUrl);
  });
});
