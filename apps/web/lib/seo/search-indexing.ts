import type { Metadata } from 'next';
import type { NextResponse } from 'next/server';

/**
 * Public search indexing is blocked unless NEXT_PUBLIC_SITE_INDEXABLE=true.
 * Unset and explicit "false" both keep the site out of Google — use false
 * in Vercel now so you only need to flip to true at launch.
 */
export function isSearchIndexingAllowed(): boolean {
  return process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true';
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

export function getSearchIndexingRobots(): Metadata['robots'] {
  return isSearchIndexingAllowed() ? ALLOWED_ROBOTS : BLOCKED_ROBOTS;
}

export const NOINDEX_ROBOTS_HEADER = 'noindex, nofollow, noarchive, nosnippet';

export function applyNoIndexResponseHeader(response: NextResponse): NextResponse {
  if (!isSearchIndexingAllowed()) {
    response.headers.set('X-Robots-Tag', NOINDEX_ROBOTS_HEADER);
  }

  return response;
}
