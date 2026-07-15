import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vercel multi-tenant pattern: rewrite hostname → /tenant/[host]/[[...slug]]
 * so one deployment serves *.sites.ozer.so + verified custom domains.
 *
 * Note: do not use an `_…` folder — Next.js treats underscore-prefixed
 * app directories as private and excludes them from routing (causing 404s).
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/tenant/')) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const slug = pathname === '/' ? '' : pathname.replace(/^\//, '');
  url.pathname = slug ? `/tenant/${host}/${slug}` : `/tenant/${host}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
