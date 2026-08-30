const CACHE = 'ozer-static-v8';
const PRECACHE = [
  '/manifest.webmanifest',
  '/images/brand/pwa-icon-512.png',
  '/family-shopping-offline.html',
  '/family-shopping-offline.js',
];

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
  const path = (pathname.split('?')[0] || pathname).replace(/\/+$/, '') || '/';

  if (
    path === '/app/life/family/shopping' ||
    path === '/home/life/family/shopping'
  ) {
    return true;
  }

  return /^\/(app|home)\/[^/]+\/shopping$/.test(path);
}

function isShoppingDocumentRequest(request, url) {
  if (request.method !== 'GET') return false;
  if (request.mode !== 'navigate' && request.destination !== 'document') {
    return false;
  }
  return isFamilyShoppingPath(url.pathname);
}

async function networkFirstShoppingDocument(request) {
  try {
    return await fetch(request);
  } catch {
    // Do not cache the authenticated shopping shell. If they opened the list
    // before, IndexedDB has it; this lightweight page reads that snapshot.
    const fallback = await caches.match('/family-shopping-offline.html');
    if (fallback) return fallback;

    return new Response('Shopping is unavailable offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Shopping only: network first, then a dedicated offline document.
  // Everything else under /app and /home still bypasses.
  if (isShoppingDocumentRequest(request, url)) {
    event.respondWith(networkFirstShoppingDocument(request));
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
