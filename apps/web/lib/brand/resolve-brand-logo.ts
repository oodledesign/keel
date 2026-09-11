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

/** Dark navy / brand plates use the on-dark logo; pale plates use on-light. */
export function brandLogoSurfaceForHex(
  hex: string | null | undefined,
): BrandLogoSurface {
  const cleaned = (hex ?? '').replace('#', '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) return 'dark';
  const n = Number.parseInt(cleaned, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55 ? 'dark' : 'light';
}

export const BRAND_LOGO_CHOICES = ['primary', 'on_light', 'on_dark'] as const;

export type BrandLogoChoice = (typeof BRAND_LOGO_CHOICES)[number];

/**
 * Campaign Logo block: pick Primary / On light / On dark, with fallback
 * if that variant has not been uploaded in Brand settings.
 */
export function resolveBrandLogoChoice(
  brand: BrandLogoSources,
  choice: BrandLogoChoice = 'primary',
): string | null {
  if (choice === 'on_light') {
    return resolveBrandLogoForSurface(brand, 'light');
  }

  if (choice === 'on_dark') {
    return resolveBrandLogoForSurface(brand, 'dark');
  }

  return firstUrl(
    brand.logo_url,
    brand.logo_on_light_url,
    brand.logo_on_dark_url,
  );
}

export function brandLogoChoiceIsExact(
  brand: BrandLogoSources,
  choice: BrandLogoChoice,
): boolean {
  if (choice === 'primary') return Boolean(brand.logo_url?.trim());
  if (choice === 'on_light') return Boolean(brand.logo_on_light_url?.trim());
  return Boolean(brand.logo_on_dark_url?.trim());
}
