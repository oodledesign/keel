import type { Metadata } from 'next';

import type { NextResponse } from 'next/server';

/**
 * Public search indexing is blocked unless NEXT_PUBLIC_SITE_INDEXABLE=true.
 * Unset and explicit "false" both keep the site out of Google — use false
 * in Vercel now so you only need to flip to true at launch.
 *
 * Legal trust pages stay indexable either way (privacy, terms, DPA).
 */
export function isSearchIndexingAllowed(): boolean {
  return process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true';
}

/** Paths that remain crawlable/indexable even when the site-wide gate is off. */
export const ALWAYS_INDEXABLE_PATHS = [
  '/privacy-policy',
  '/terms-of-service',
  '/dpa',
] as const;

export function isAlwaysIndexablePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (ALWAYS_INDEXABLE_PATHS as readonly string[]).includes(normalized);
}

const BLOCKED_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

const ALLOWED_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
};

export function getSearchIndexingRobots(options?: {
  path?: string;
}): Metadata['robots'] {
  if (
    isSearchIndexingAllowed() ||
    (options?.path && isAlwaysIndexablePath(options.path))
  ) {
    return ALLOWED_ROBOTS;
  }

  return BLOCKED_ROBOTS;
}

export const NOINDEX_ROBOTS_HEADER = 'noindex, nofollow, noarchive, nosnippet';

export function applyNoIndexResponseHeader(
  response: NextResponse,
  pathname?: string,
): NextResponse {
  if (pathname && isAlwaysIndexablePath(pathname)) {
    response.headers.delete('X-Robots-Tag');
    return response;
  }

  if (!isSearchIndexingAllowed()) {
    response.headers.set('X-Robots-Tag', NOINDEX_ROBOTS_HEADER);
  }

  return response;
}
