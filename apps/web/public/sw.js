const CACHE = 'keel-static-v5';
const PRECACHE = ['/manifest.webmanifest', '/images/brand/pwa-icon-512.png'];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
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
    title: 'Keel',
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
