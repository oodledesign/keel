import { describe, expect, it } from 'vitest';

import {
  brandLogoChoiceIsExact,
  brandLogoSurfaceForPage,
  resolveBrandLogoChoice,
  resolveBrandLogoForSurface,
} from './resolve-brand-logo';

const brand = {
  logo_url: 'https://cdn.example.com/primary.png',
  logo_on_light_url: 'https://cdn.example.com/on-light.png',
  logo_on_dark_url: 'https://cdn.example.com/on-dark.png',
};

describe('resolveBrandLogoForSurface', () => {
  it('prefers the matching variant, then primary, then the other variant', () => {
    expect(resolveBrandLogoForSurface(brand, 'light')).toBe(
      brand.logo_on_light_url,
    );
    expect(resolveBrandLogoForSurface(brand, 'dark')).toBe(
      brand.logo_on_dark_url,
    );
    expect(
      resolveBrandLogoForSurface({ logo_url: brand.logo_url }, 'dark'),
    ).toBe(brand.logo_url);
    expect(
      resolveBrandLogoForSurface(
        { logo_on_dark_url: brand.logo_on_dark_url },
        'light',
      ),
    ).toBe(brand.logo_on_dark_url);
  });

  it('returns null when no logos are set', () => {
    expect(resolveBrandLogoForSurface({}, 'light')).toBeNull();
  });
});

describe('brandLogoSurfaceForPage', () => {
  it('uses the light logo when content sits on the off-white shell', () => {
    expect(
      brandLogoSurfaceForPage({ pageOnDark: true, logoOnLightShell: true }),
    ).toBe('light');
  });

  it('follows the page background when the logo sits on the page', () => {
    expect(brandLogoSurfaceForPage({ pageOnDark: true })).toBe('dark');
    expect(brandLogoSurfaceForPage({ pageOnDark: false })).toBe('light');
  });
});

describe('resolveBrandLogoChoice', () => {
  it('uses the primary logo first, then light, then dark', () => {
    expect(resolveBrandLogoChoice(brand, 'primary')).toBe(brand.logo_url);
    expect(
      resolveBrandLogoChoice(
        {
          logo_on_light_url: brand.logo_on_light_url,
          logo_on_dark_url: brand.logo_on_dark_url,
        },
        'primary',
      ),
    ).toBe(brand.logo_on_light_url);
  });

  it('falls back when the chosen variant is missing', () => {
    expect(
      resolveBrandLogoChoice({ logo_url: brand.logo_url }, 'on_dark'),
    ).toBe(brand.logo_url);
    expect(
      resolveBrandLogoChoice(
        { logo_on_light_url: brand.logo_on_light_url },
        'on_dark',
      ),
    ).toBe(brand.logo_on_light_url);
    expect(brandLogoChoiceIsExact(brand, 'on_light')).toBe(true);
    expect(
      brandLogoChoiceIsExact({ logo_url: brand.logo_url }, 'on_light'),
    ).toBe(false);
  });
});
