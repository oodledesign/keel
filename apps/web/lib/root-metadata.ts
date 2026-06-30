import { Metadata, Viewport } from 'next';

import appConfig from '~/config/app.config';
import { brandAssets, brandConfig } from '~/config/brand.config';
import { getSearchIndexingRobots } from '~/lib/seo/search-indexing';
export const generateRootMetadata = (): Metadata => ({
  title: appConfig.title,
  description: appConfig.description,
  metadataBase: new URL(appConfig.url),
  applicationName: appConfig.name,
  manifest: '/manifest.webmanifest',
  robots: getSearchIndexingRobots(),
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
      { url: brandAssets.favicon, type: 'image/svg+xml' },
      { url: brandConfig.logos.icon.light, type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: brandConfig.logos.icon.light,
  },
});

export const generateRootViewport = (): Viewport => ({
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: appConfig.themeColor },
    { media: '(prefers-color-scheme: dark)', color: appConfig.themeColorDark },
  ],
});
