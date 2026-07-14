import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vercel multi-tenant pattern: rewrite hostname → /_sites/[host]/[[...slug]]
 * so one deployment serves *.sites.ozer.so + verified custom domains.
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

  if (pathname.startsWith('/_sites/')) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const slug = pathname === '/' ? '' : pathname.replace(/^\//, '');
  url.pathname = slug ? `/_sites/${host}/${slug}` : `/_sites/${host}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
