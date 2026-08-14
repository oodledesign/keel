import type { ReactNode } from 'react';

import { headers } from 'next/headers';
import Image from 'next/image';

import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { getPageMap } from 'nextra/page-map';

import { workspaceFromPathname } from '../lib/workspaces';

import type { ComponentProps } from 'react';

const footer = (
  <Footer>
    <a href="https://www.ozer.so" target="_blank" rel="noopener noreferrer">
      Ozer
    </a>
    {' · '}
    Workspace OS documentation · {new Date().getFullYear()}
  </Footer>
);

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

/**
 * Template (not layout) so workspace sidebar pageMap refreshes on navigation.
 * Root layouts are preserved across client navigations in the App Router.
 */
export default async function DocsTemplate({
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

  return (
    <Layout
      navbar={navbar}
      footer={footer}
      pageMap={pageMap}
      editLink={null}
      feedback={{ content: null }}
      sidebar={{ defaultMenuCollapseLevel: 1 }}
      darkMode
      nextThemes={
        {
          defaultTheme: 'light',
          enableSystem: false,
          storageKey: 'ozer-docs-theme',
        } as ComponentProps<typeof Layout>['nextThemes']
      }
    >
      {children}
    </Layout>
  );
}
