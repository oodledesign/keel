'use client';

import {
  SHOPPING_OFFLINE_NAV_TIMEOUT_MS,
  isShoppingOfflineInterceptRequest,
  isShoppingRscRequest,
  isUnusableShoppingRscResponse,
  shoppingDocumentHref,
  shouldHardNavigateShoppingLink,
} from '~/lib/meals/shopping-offline-paths';

let installed = false;
let pendingAssign: string | null = null;

function resolveRequestUrl(input: RequestInfo | URL, base: string): URL | null {
  try {
    if (input instanceof URL) return new URL(input.href);
    if (typeof input === 'string') return new URL(input, base);
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url);
    }
  } catch {
    return null;
  }

  return null;
}

function mergedHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): Headers | undefined {
  const headers = new Headers(
    typeof Request !== 'undefined' && input instanceof Request
      ? input.headers
      : undefined,
  );

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method;
  }
  return 'GET';
}

function requestMode(
  input: RequestInfo | URL,
  init?: RequestInit,
): string | undefined {
  if (init?.mode) return init.mode;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.mode;
  }
  return undefined;
}

function requestDestination(input: RequestInfo | URL): string | undefined {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.destination;
  }
  return undefined;
}

export function assignShoppingDocument(href: string, origin: string): void {
  const next = new URL(shoppingDocumentHref(href, origin), origin);
  const target = `${next.pathname}${next.search}${next.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (
    target === current &&
    document.querySelector('[data-test="shopping-offline-fallback"]')
  ) {
    return;
  }

  if (pendingAssign === target) return;
  pendingAssign = target;
  window.location.assign(target);
}

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function shoppingAnchor(event: Event): HTMLAnchorElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest('a');
}

function onShoppingLinkClick(event: MouseEvent): void {
  if (isModifiedClick(event)) return;

  const anchor = shoppingAnchor(event);
  if (!anchor?.href) return;

  if (
    !shouldHardNavigateShoppingLink({
      href: anchor.href,
      defaultPrevented: event.defaultPrevented,
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      target: anchor.getAttribute('target'),
      origin: window.location.origin,
    })
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  assignShoppingDocument(anchor.href, window.location.origin);
}

function onServiceWorkerMessage(event: MessageEvent): void {
  const data = event.data as { type?: string; url?: string } | null;
  if (data?.type !== 'OZER_SHOPPING_OFFLINE' || !data.url) return;
  assignShoppingDocument(data.url, window.location.origin);
}

function hang(): Promise<Response> {
  return new Promise(() => undefined);
}

/**
 * Shopping nav and App Router RSC flights must become a real document load
 * when the network fails, so the service worker can serve the offline list.
 */
export function installShoppingOfflineNavigation(): () => void {
  if (typeof window === 'undefined' || installed) {
    return () => undefined;
  }

  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveRequestUrl(input, window.location.origin);
    if (!url || url.origin !== window.location.origin) {
      return originalFetch(input, init);
    }

    const request = {
      method: requestMethod(input, init),
      mode: requestMode(input, init),
      destination: requestDestination(input),
      url: url.href,
      headers: mergedHeaders(input, init),
    };

    if (!isShoppingOfflineInterceptRequest(request)) {
      return originalFetch(input, init);
    }

    let timer = 0;

    try {
      const response = await Promise.race([
        originalFetch(input, init),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => {
            reject(new TypeError('Failed to fetch'));
          }, SHOPPING_OFFLINE_NAV_TIMEOUT_MS);
        }),
      ]);

      window.clearTimeout(timer);

      if (
        isShoppingRscRequest(request) &&
        (response.status >= 500 ||
          isUnusableShoppingRscResponse(response.headers.get('content-type')))
      ) {
        assignShoppingDocument(url.href, window.location.origin);
        return hang();
      }

      return response;
    } catch {
      window.clearTimeout(timer);
      assignShoppingDocument(url.href, window.location.origin);
      return hang();
    }
  };

  document.addEventListener('click', onShoppingLinkClick, true);
  navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);

  return () => {
    window.fetch = originalFetch;
    document.removeEventListener('click', onShoppingLinkClick, true);
    navigator.serviceWorker?.removeEventListener(
      'message',
      onServiceWorkerMessage,
    );
    installed = false;
    pendingAssign = null;
  };
}
