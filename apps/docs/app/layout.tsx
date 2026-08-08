import type { ReactNode } from 'react';

import type { Metadata } from 'next';

import Image from 'next/image';

import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';

import './globals.css';

const siteUrl =
  process.env.NEXT_PUBLIC_DOCS_URL?.replace(/\/$/, '') ||
  'https://docs.ozer.so';

const siteTitle = 'Ozer Docs';
const siteDescription =
  'Documentation for Ozer — the Workspace OS for freelancers and small studios.';

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

const navbar = (
  <Navbar
    logo={
      <span className="ozer-docs-logo">
        <Image
          className="ozer-docs-logo-light"
          src="/brand/ozer-wordmark-on-light.svg"
          alt="Ozer"
          width={100}
          height={24}
          priority
        />
        <Image
          className="ozer-docs-logo-dark"
          src="/brand/ozer-wordmark-on-dark.svg"
          alt="Ozer"
          width={100}
          height={24}
          priority
        />
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Docs</span>
      </span>
    }
    logoLink="/"
    projectLink="https://www.ozer.so"
  />
);

const footer = (
  <Footer>
    <a href="https://www.ozer.so" rel="noopener noreferrer">
      Ozer
    </a>
    {' · '}
    Workspace OS documentation · {new Date().getFullYear()}
  </Footer>
);

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={pageMap}
          editLink={null}
          feedback={{ content: null }}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          darkMode
          nextThemes={{ defaultTheme: 'light' }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
