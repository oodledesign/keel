import { Metadata, Viewport } from 'next';

import appConfig from '~/config/app.config';
import { brandConfig } from '~/config/brand.config';

/**
 * @name generateRootMetadata
 * @description Generates the root metadata for the application.
 * Kept static (no headers()) to avoid Next.js 16 metadata boundary hydration mismatch.
 * CSRF is read from cookies/headers at request time where needed.
 */
export const generateRootMetadata = (): Metadata => ({
  title: appConfig.title,
  description: appConfig.description,
  metadataBase: new URL(appConfig.url),
  applicationName: appConfig.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: appConfig.name,
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
      url: appConfig.url,
      siteName: appConfig.name,
      title: appConfig.title,
      description: appConfig.description,
    },
  twitter: {
    card: 'summary_large_image',
    title: appConfig.title,
    description: appConfig.description,
  },
  icons: {
    icon: [
      { url: '/images/brand/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: brandConfig.logos.icon.light, type: 'image/png', sizes: '512x512' },
    ],
    apple: '/images/brand/apple-touch-icon.png',
  },
});

export const generateRootViewport = (): Viewport => ({
  colorScheme: 'dark',
  themeColor: appConfig.themeColorDark,
});
