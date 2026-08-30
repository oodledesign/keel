export const FAMILY_SHOPPING_OFFLINE_HREF = '/family-shopping-offline.html';
export const SHOPPING_OFFLINE_NAV_TIMEOUT_MS = 4_000;

export type ShoppingRequestLike = {
  method?: string;
  mode?: string;
  destination?: string;
  url: string;
  headers?: Headers | Record<string, string | null | undefined>;
};

export function isFamilyShoppingPath(pathname: string): boolean {
  const withoutSearch = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  const path = withoutSearch.replace(/\/+$/, '') || '/';

  if (
    path === '/app/life/family/shopping' ||
    path === '/home/life/family/shopping'
  ) {
    return true;
  }

  return /^\/(app|home)\/[^/]+\/shopping$/.test(path);
}

function requestUrl(url: string, base = 'http://ozer.invalid'): URL {
  return new URL(url, base);
}

function headerValue(
  headers: ShoppingRequestLike['headers'],
  name: string,
): string | null {
  if (!headers) return null;

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(name);
  }

  const record = headers as Record<string, string | null | undefined>;
  const direct = record[name] ?? record[name.toLowerCase()];
  if (direct != null) return direct;

  const match = Object.entries(record).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );

  return match?.[1] ?? null;
}

export function shoppingDocumentHref(
  href: string,
  base = 'http://ozer.invalid',
): string {
  const url = requestUrl(href, base);
  url.searchParams.delete('_rsc');
  url.searchParams.delete('_nextRouterPrefetch');
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}

export function isNextRouterPrefetchRequest(
  request: ShoppingRequestLike,
): boolean {
  const url = requestUrl(request.url);
  return (
    url.searchParams.has('_nextRouterPrefetch') ||
    headerValue(request.headers, 'Next-Router-Prefetch') === '1'
  );
}

export function isShoppingRscRequest(request: ShoppingRequestLike): boolean {
  if (!isFamilyShoppingPath(requestUrl(request.url).pathname)) {
    return false;
  }

  const url = requestUrl(request.url);
  return (
    url.searchParams.has('_rsc') || headerValue(request.headers, 'RSC') === '1'
  );
}

export function isShoppingDocumentNavigation(
  request: ShoppingRequestLike,
): boolean {
  if ((request.method ?? 'GET').toUpperCase() !== 'GET') return false;
  if (!isFamilyShoppingPath(requestUrl(request.url).pathname)) return false;

  return request.mode === 'navigate' || request.destination === 'document';
}

/**
 * Shopping GETs the service worker should handle: document navigations and
 * App Router RSC flights. Prefetches stay bypassed. Do not use this to cache
 * the authenticated /app shell.
 */
export function isShoppingOfflineInterceptRequest(
  request: ShoppingRequestLike,
): boolean {
  if ((request.method ?? 'GET').toUpperCase() !== 'GET') return false;
  if (!isFamilyShoppingPath(requestUrl(request.url).pathname)) return false;
  if (isNextRouterPrefetchRequest(request)) return false;

  return isShoppingDocumentNavigation(request) || isShoppingRscRequest(request);
}

export function isUnusableShoppingRscResponse(
  contentType: string | null,
): boolean {
  const type = contentType?.toLowerCase() ?? '';
  return !type.includes('text/x-component');
}

export function shouldHardNavigateShoppingLink(input: {
  href: string;
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: string | null;
  origin?: string;
}): boolean {
  if (input.defaultPrevented) return false;
  if ((input.button ?? 0) !== 0) return false;
  if (input.metaKey || input.ctrlKey || input.shiftKey || input.altKey) {
    return false;
  }

  const target = input.target?.trim();
  if (target && target !== '_self') return false;

  try {
    const url = requestUrl(input.href, input.origin ?? 'http://ozer.invalid');
    if (input.origin && url.origin !== input.origin) return false;
    return isFamilyShoppingPath(url.pathname);
  } catch {
    return false;
  }
}
