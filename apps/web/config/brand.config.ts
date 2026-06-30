/**
 * Brand configuration for Ozer
 * Logo paths and brand colors for use across the application
 */

export const brandAssets = {
  /** Flower mark (sidebar collapsed, favicon) */
  icon: '/brand/ozer-icon.svg',
  /** Wordmark on cream / light surfaces */
  wordmarkOnLight: '/brand/ozer-wordmark-on-light.svg',
  /** Wordmark on plum / dark surfaces */
  wordmarkOnDark: '/brand/ozer-wordmark-on-dark.svg',
  /** App favicon (plum tile + coral mark) */
  favicon: '/favicon.svg',
} as const;

export const brandConfig = {
  logos: {
    iconText: {
      light: brandAssets.wordmarkOnLight,
      dark: brandAssets.wordmarkOnDark,
    },
    icon: {
      light: brandAssets.icon,
      dark: brandAssets.icon,
    },
    text: {
      light: brandAssets.wordmarkOnLight,
      dark: brandAssets.wordmarkOnDark,
    },
  },
  colors: {
    primary: {
      coral: '#FF5C34',
      plum: '#351E28',
    },
    canvas: {
      light: '#FBF6EC',
      dark: '#351E28',
    },
  },
} as const;
