import type { CSSProperties } from 'react';

import localFont from 'next/font/local';

import type { BrandFontId, BrandFonts } from '~/lib/brand/brand-fonts.shared';

// next/font needs literal options per font. preload is off: browsers only
// download the faces a public page actually renders with.

const inter = localFont({
  src: [
    { path: './fonts/inter-regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-bold.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

const dmSans = localFont({
  src: [
    { path: './fonts/dm-sans-regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/dm-sans-bold.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

const montserrat = localFont({
  src: [
    {
      path: './fonts/montserrat-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    { path: './fonts/montserrat-bold.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

const poppins = localFont({
  src: [
    { path: './fonts/poppins-regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-bold.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

const lora = localFont({
  src: [
    { path: './fonts/lora-regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/lora-bold.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

const playfairDisplay = localFont({
  src: [
    {
      path: './fonts/playfair-display-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/playfair-display-bold.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

const merriweather = localFont({
  src: [
    {
      path: './fonts/merriweather-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    { path: './fonts/merriweather-bold.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

const libreBaskerville = localFont({
  src: [
    {
      path: './fonts/libre-baskerville-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/libre-baskerville-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

const FONT_FAMILIES: Record<BrandFontId, string> = {
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  inter: inter.style.fontFamily,
  'dm-sans': dmSans.style.fontFamily,
  montserrat: montserrat.style.fontFamily,
  poppins: poppins.style.fontFamily,
  lora: lora.style.fontFamily,
  'playfair-display': playfairDisplay.style.fontFamily,
  merriweather: merriweather.style.fontFamily,
  'libre-baskerville': libreBaskerville.style.fontFamily,
};

export function brandFontFamily(id: BrandFontId): string {
  return FONT_FAMILIES[id];
}

/**
 * Re-points Tailwind's `font-sans` / `font-heading` (and inherited text) at
 * the workspace brand fonts inside the element it's applied to. Empty when
 * the workspace kept the standard fonts.
 */
export function brandFontStyle(
  fonts: BrandFonts | null | undefined,
): CSSProperties {
  const style: Record<string, string> = {};
  if (!fonts) return style;
  if (fonts.body) {
    const family = FONT_FAMILIES[fonts.body];
    style['--font-sans'] = family;
    style.fontFamily = family;
  }
  if (fonts.heading) {
    style['--font-heading'] = FONT_FAMILIES[fonts.heading];
  }
  return style as CSSProperties;
}
