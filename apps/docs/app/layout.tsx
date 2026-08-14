import type { ReactNode } from 'react';

import type { Metadata } from 'next';

import { Head } from 'nextra/components';

import './globals.css';

const siteUrl =
  process.env.NEXT_PUBLIC_DOCS_URL?.replace(/\/$/, '') ||
  'https://docs.ozer.so';

const siteTitle = 'Ozer Docs';
const siteDescription =
  'Step-by-step documentation for Ozer — Personal, Business, and Commercial property workspaces.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: `%s — ${siteTitle}`,
    default: siteTitle,
  },
  description: siteDescription,
  applicationName: siteTitle,
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: siteUrl,
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: 'summary',
    title: siteTitle,
    description: siteDescription,
  },
  alternates: {
    canonical: siteUrl,
  },
};

/**
 * Root shell only. Pathname-dependent sidebar lives in `template.tsx` so it
 * remounts on client navigations (layouts do not).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>{children}</body>
    </html>
  );
}
