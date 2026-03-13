import { Metadata } from 'next';

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
      { url: brandConfig.logos.icon.light, type: 'image/png', sizes: 'any' },
      { url: brandConfig.logos.icon.dark, type: 'image/png', sizes: 'any', media: '(prefers-color-scheme: dark)' },
    ],
    apple: brandConfig.logos.icon.light,
  },
});
