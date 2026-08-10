import type { ReactNode } from 'react';

import type { Metadata } from 'next';

import { headers } from 'next/headers';
import Image from 'next/image';

import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';

import { workspaceFromPathname } from '../lib/workspaces';

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

const footer = (
  <Footer>
    <a
      href="https://www.ozer.so"
      target="_blank"
      rel="noopener noreferrer"
    >
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
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '/';
  const workspace = workspaceFromPathname(pathname);
  const pageMap = workspace
    ? await getPageMap(`/${workspace}`)
    : await getPageMap('/');

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
          <span className="ozer-docs-logo-text">Docs</span>
        </span>
      }
      logoLink="/"
      projectLink="https://www.ozer.so"
      projectIcon={
        <Image
          src="/brand/ozer-icon.svg"
          alt="Ozer"
          width={24}
          height={24}
          className="ozer-docs-project-icon"
        />
      }
    />
  );

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
