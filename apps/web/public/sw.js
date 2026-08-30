const CACHE = 'ozer-static-v9';
const PRECACHE = [
  '/manifest.webmanifest',
  '/images/brand/pwa-icon-512.png',
  '/family-shopping-offline.html',
  '/family-shopping-offline.js',
];
const SHOPPING_NAV_TIMEOUT_MS = 4000;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldBypassServiceWorker(request, url) {
  if (request.method !== 'GET') return true;

  // Never cache navigations, RSC flights, or authenticated app shells — breaks sessions.
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.startsWith('/app') ||
    url.pathname.startsWith('/home') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/api') ||
    url.searchParams.has('_rsc') ||
    url.searchParams.has('_nextRouterPrefetch') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1'
  ) {
    return true;
  }

  return false;
}

function isFamilyShoppingPath(pathname) {
  const path =
    (pathname.split('?')[0] || pathname).split('#')[0].replace(/\/+$/, '') ||
    '/';

  if (
    path === '/app/life/family/shopping' ||
    path === '/home/life/family/shopping'
  ) {
    return true;
  }

  return /^\/(app|home)\/[^/]+\/shopping$/.test(path);
}

function isNextRouterPrefetch(request, url) {
  return (
    url.searchParams.has('_nextRouterPrefetch') ||
    request.headers.get('Next-Router-Prefetch') === '1'
  );
}

function isShoppingRscRequest(request, url) {
  if (!isFamilyShoppingPath(url.pathname)) return false;
  return url.searchParams.has('_rsc') || request.headers.get('RSC') === '1';
}

function isShoppingDocumentRequest(request, url) {
  if (request.method !== 'GET') return false;
  if (!isFamilyShoppingPath(url.pathname)) return false;
  return request.mode === 'navigate' || request.destination === 'document';
}

// Keep in sync with shopping-offline-paths.ts:
// isFamilyShoppingPath, isShoppingOfflineInterceptRequest, shoppingDocumentHref.
function isShoppingOfflineInterceptRequest(request, url) {
  if (request.method !== 'GET') return false;
  if (!isFamilyShoppingPath(url.pathname)) return false;
  if (isNextRouterPrefetch(request, url)) return false;
  return isShoppingDocumentRequest(request, url) || isShoppingRscRequest(request, url);
}

function shoppingDocumentHref(url) {
  const next = new URL(url.href);
  next.searchParams.delete('_rsc');
  next.searchParams.delete('_nextRouterPrefetch');
  return `${next.pathname}${next.search}${next.hash}`;
}

function fetchWithTimeout(request, ms) {
  const isNavigate =
    request.mode === 'navigate' || request.destination === 'document';

  // Do not reconstruct document navigations — cloning can drop credentials.
  if (isNavigate) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      fetch(request)
        .then((response) => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  const controller = new AbortController();
  const incoming = request.signal;
  if (incoming) {
    if (incoming.aborted) {
      controller.abort();
    } else {
      incoming.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }
  }

  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return fetch(new Request(request, { signal: controller.signal })).finally(
      () => clearTimeout(timer),
    );
  } catch {
    return new Promise((resolve, reject) => {
      fetch(request)
        .then((response) => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

async function offlineShoppingDocument() {
  const fallback = await caches.match('/family-shopping-offline.html');
  if (fallback) return fallback;

  return new Response('Shopping is unavailable offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function navigateClientToShopping(event, url) {
  const href = shoppingDocumentHref(url);
  const client = event.clientId
    ? await self.clients.get(event.clientId)
    : null;

  if (client && 'navigate' in client) {
    try {
      await client.navigate(href);
      return;
    } catch {
      // Safari may reject WindowClient.navigate; tell the page instead.
    }
  }

  if (client) {
    client.postMessage({ type: 'OZER_SHOPPING_OFFLINE', url: href });
  }
}

async function networkFirstShopping(event, request, url) {
  try {
    const response = await fetchWithTimeout(request, SHOPPING_NAV_TIMEOUT_MS);
    if (response && response.ok) return response;
    if (response && response.status < 500) return response;
    throw new Error('unavailable');
  } catch {
    // Do not cache the authenticated shopping shell. If they opened the list
    // before, IndexedDB has it; this lightweight page reads that snapshot.
    if (isShoppingDocumentRequest(request, url)) {
      return offlineShoppingDocument();
    }

    // Document fallback is handled above. For RSC, navigate the tab to the
    // shopping URL (the page-side fetch patch also location.assign's).
    await navigateClientToShopping(event, url);
    throw new TypeError('Failed to fetch');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Shopping only: network first (including RSC), then the offline document.
  // Everything else under /app and /home still bypasses — do not cache the shell.
  if (isShoppingOfflineInterceptRequest(request, url)) {
    event.respondWith(networkFirstShopping(event, request, url));
    return;
  }

  if (shouldBypassServiceWorker(request, url)) return;

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Ozer',
    body: 'Something is coming up on your plan',
    url: '/app/planner/day',
    tag: 'planner-reminder',
  };

  try {
    const data = event.data?.json();
    if (data && typeof data === 'object') {
      payload = { ...payload, ...data };
    }
  } catch {
    const text = event.data?.text()?.trim();
    if (text) payload.body = text;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/images/brand/pwa-icon-192.png',
      badge: '/images/brand/pwa-icon-192.png',
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    '/app/planner/day';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
