import { isReservedWorkspaceUrlSegment } from '@kit/shared/workspace-url';

/** Map internal `/home/*` routes to public `/app/*` URLs for client-side route checks. */
export function normalizePublicPathname(pathname: string): string {
  if (!pathname) {
    return pathname;
  }

  if (pathname === '/home') {
    return '/app';
  }

  if (pathname.startsWith('/home/')) {
    return `/app${pathname.slice('/home'.length)}`;
  }

  return pathname;
}

/** Workspace dashboard home, e.g. /app/oodle — disable pull-to-refresh to avoid refresh loops. */
export function isWorkspaceDashboardHome(pathname: string): boolean {
  const normalized = normalizePublicPathname(pathname);
  const match = normalized.match(/^\/app\/([^/]+)\/?$/);

  if (!match?.[1]) {
    return false;
  }

  return !isReservedWorkspaceUrlSegment(match[1]);
}
