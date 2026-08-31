import { type NextRequest, NextResponse } from 'next/server';

export function safeFeedflowReturnPath(
  returnParam: string | null | undefined,
): string | null {
  if (!returnParam) return null;
  if (!returnParam.startsWith('/')) return null;
  if (returnParam.startsWith('//')) return null;
  return returnParam;
}

/** Stay on the current host (preview vs production) and keep the error visible. */
export function feedflowErrorRedirect(
  request: NextRequest,
  path: string,
  message: string,
) {
  console.error('[feedflow] oauth', message);

  const url = new URL(path, request.nextUrl.origin);
  url.searchParams.set('feedflow_error', message);
  return NextResponse.redirect(url);
}

export function feedflowAppUrl(request: NextRequest, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, request.nextUrl.origin).toString();
}
