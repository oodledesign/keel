export type BrandLogoSurface = 'light' | 'dark';

export const BRAND_LOGO_VARIANTS = ['on_light', 'on_dark'] as const;

export type BrandLogoVariant = (typeof BRAND_LOGO_VARIANTS)[number];

export type BrandLogoSources = {
  logo_url?: string | null;
  logo_on_light_url?: string | null;
  logo_on_dark_url?: string | null;
};

function firstUrl(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Pick a workspace logo for the surface it will sit on.
 * Dark navy / brand-gradient pages use the dark-mode (light) logo.
 * Light pages use the light-mode (dark) logo. Primary logo is the fallback.
 */
export function resolveBrandLogoForSurface(
  brand: BrandLogoSources,
  surface: BrandLogoSurface,
): string | null {
  if (surface === 'dark') {
    return firstUrl(
      brand.logo_on_dark_url,
      brand.logo_url,
      brand.logo_on_light_url,
    );
  }

  return firstUrl(
    brand.logo_on_light_url,
    brand.logo_url,
    brand.logo_on_dark_url,
  );
}

export function brandLogoSurfaceForPage(input: {
  pageOnDark: boolean;
  logoOnLightShell?: boolean;
}): BrandLogoSurface {
  if (input.logoOnLightShell) return 'light';
  return input.pageOnDark ? 'dark' : 'light';
}
