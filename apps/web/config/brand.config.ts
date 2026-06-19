/**
 * Brand configuration for Ozer
 * Contains logo paths and brand colors for use across the application
 */

export const brandAssets = {
  /** Dark wordmark for light surfaces */
  wordmarkLight: '/brand/keel-dark-transparent.png',
  /** White wordmark for dark surfaces */
  wordmarkDark: '/brand/keel-white-transparent.png',
  /** Icon mark for favicons, collapsed sidebar, etc. */
  icon: '/brand/keel-icon.png',
} as const;

export const brandConfig = {
  logos: {
    // Logo with icon + text (for headers, footers)
    iconText: {
      light: brandAssets.wordmarkLight,
      dark: brandAssets.wordmarkDark,
    },
    // Icon only (for favicons, small spaces)
    icon: {
      light: brandAssets.icon,
      dark: brandAssets.icon,
    },
    // Text only (wordmarks without separate text-only assets)
    text: {
      light: brandAssets.wordmarkLight,
      dark: brandAssets.wordmarkDark,
    },
  },
  colors: {
    // Primary brand colors
    primary: {
      green: '#57C87F', // Greenwave
      slate: '#3D4E5D', // Slate Blue
    },
    // Secondary colors from style guide
    secondary: {
      teal: {
        base: '#146F6F',
        300: '#187A99',
        200: '#85C6D6',
        100: '#C0E7E1',
      },
      deepPurple: {
        base: '#331448',
        300: '#8D6BA5',
        200: '#B790CB',
        100: '#EBE0F1',
      },
      brightTangerine: {
        base: '#FF8A3D',
        300: '#FFA869',
        200: '#FFC69A',
        100: '#FFE3CC',
      },
      green: {
        base: '#57CB7F',
        300: '#ADECCB',
        200: '#D3F2D0',
        100: '#EAF7F2',
      },
    },
    // Neutral colors
    neutral: {
      800: '#2A3845',
      700: '#353E5C',
      600: '#5A6976',
      500: '#828E98',
      400: '#B7BDC1',
      300: '#EDEFFF',
      200: '#F3F4F5',
      white: '#FFFFFF',
    },
  },
} as const;
