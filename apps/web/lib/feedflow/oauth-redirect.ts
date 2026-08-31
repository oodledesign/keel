import { type NextRequest, NextResponse } from 'next/server';

import { isReservedWorkspaceUrlSegment } from '@kit/shared/workspace-url';

import pathsConfig from '~/config/paths.config';
import {
  getExplicitPersonalHomePath,
  isPersonalDashboardRoot,
} from '~/lib/dashboard-shortcuts/personal-home-url';

export function safeFeedflowReturnPath(
  returnParam: string | null | undefined,
): string | null {
  if (!returnParam) return null;
  if (!returnParam.startsWith('/')) return null;
  if (returnParam.startsWith('//')) return null;
  return returnParam;
}

export function pathnameOnly(path: string): string {
  return path.split(/[?#]/)[0] ?? path;
}

export function workspaceSlugFromAppPath(path: string): string | null {
  const pathname = pathnameOnly(path);
  const match = pathname.match(/^\/app\/([^/]+)/);
  const segment = match?.[1];
  if (!segment || isReservedWorkspaceUrlSegment(segment)) {
    return null;
  }
  return segment;
}

export function feedflowSocialAccountsPath(slug: string): string {
  return pathsConfig.app.accountFeedflowSocialAccounts.replace(
    '[account]',
    slug,
  );
}

function isFeedflowSurface(path: string): boolean {
  const pathname = pathnameOnly(path);
  return /\/(social|reviews|widgets)(\/|$)/.test(pathname);
}

export function sameOriginRefererPath(
  origin: string,
  referer: string | null | undefined,
): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (url.origin !== origin) return null;
    return safeFeedflowReturnPath(`${url.pathname}${url.search}`);
  } catch {
    return null;
  }
}

/**
 * Errors must land on a Feedflow page that renders `feedflow_error`.
 * Bare `/app` is rewritten by middleware to the default workspace and
 * historically dropped the query — that is the silent dashboard bounce.
 */
export function resolveFeedflowErrorPath(input: {
  origin: string;
  returnParam?: string | null;
  referer?: string | null;
  slug?: string | null;
}): string {
  const candidates = [
    input.returnParam,
    sameOriginRefererPath(input.origin, input.referer),
  ];

  for (const candidate of candidates) {
    const safe = safeFeedflowReturnPath(candidate);
    if (!safe) continue;

    const path = pathnameOnly(safe);
    if (isPersonalDashboardRoot(path)) continue;

    if (isFeedflowSurface(path)) {
      return path;
    }

    const slug = workspaceSlugFromAppPath(path);
    if (slug) {
      return feedflowSocialAccountsPath(slug);
    }

    return path;
  }

  if (input.slug) {
    return feedflowSocialAccountsPath(input.slug);
  }

  return getExplicitPersonalHomePath();
}

/** Stay on the current host (preview vs production) and keep the error visible. */
export function feedflowErrorRedirect(
  request: NextRequest,
  path: string,
  message: string,
  slug?: string | null,
) {
  console.error('[feedflow] oauth', message);

  const resolved = resolveFeedflowErrorPath({
    origin: request.nextUrl.origin,
    returnParam: path,
    referer: request.headers.get('referer'),
    slug,
  });

  const url = new URL(resolved, request.nextUrl.origin);
  url.searchParams.set('feedflow_error', message);
  return NextResponse.redirect(url);
}

export function feedflowAppUrl(request: NextRequest, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, request.nextUrl.origin).toString();
}
