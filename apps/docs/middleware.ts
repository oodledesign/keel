import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Must set on the *request* so `headers()` in Server Components can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all pathnames except static assets and Next internals.
     */
    '/((?!_next|brand|favicon.ico|.*\\..*).*)',
  ],
};
