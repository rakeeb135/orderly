/* ------------------------------------------------------------------ */
/*  ORDERLY SERVICE WORKER                                             */
/*                                                                      */
/*  Strategy:                                                           */
/*   - App shell cached individually (one failure never kills the batch) */
/*   - Static assets: stale-while-revalidate                           */
/*   - Supabase API calls: NEVER cached (always live network)          */
/*   - Navigation: network-first with a guaranteed Response fallback    */
/*   - Push notifications: display on 'push', open app on 'click'      */
/* ------------------------------------------------------------------ */

const CACHE_VERSION = 'orderly-v4'; // v4 — bump to pick up push handlers
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

/* ---------------------------------------------------------------- */
/*  Install: pre-cache app shell (individually, non-atomic)          */
/* ---------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Skipped pre-cache for ${url}:`, err.message || err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

/* ---------------------------------------------------------------- */
/*  Activate: clean old caches                                       */
/* ---------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------------------------------------------------------------- */
/*  Fetch: smart routing                                             */
/* ---------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Never touch Supabase (database, auth, storage, realtime)
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return;
  }

  // Never touch cross-origin requests (WhatsApp, analytics, extensions)
  if (url.origin !== self.location.origin) return;

  // Skip Vite dev artifacts
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@')) return;

  /* ---- SPA navigation: network-first, ALWAYS a valid Response ---- */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);

          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('/', clone)).catch(() => {});
          }

          return networkResponse;
        } catch {
          const cached = await caches.match('/');
          if (cached) return cached;

          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;color:#111813;background:#F4F6F4"><h1 style="font-weight:900">You are offline</h1><p style="color:#5A655D">Please check your internet connection and try again.</p></body></html>',
            {
              status: 200,
              statusText: 'OK (offline fallback)',
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        }
      })()
    );
    return;
  }

  /* ---- Static assets: cache-first with background refresh (SWR) --- */
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

/* ---------------------------------------------------------------- */
/*  PUSH: show notification when server sends a push                 */
/* ---------------------------------------------------------------- */
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Orderly', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = data.title || 'Orderly';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.order_id ? `order-${data.order_id}` : 'orderly-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: {
      url: data.link || '/orders',
      order_id: data.order_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------------------------------------------------------------- */
/*  NOTIFICATION CLICK: focus existing tab or open a new one          */
/* ---------------------------------------------------------------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/orders';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open, focus it and navigate to the order
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(fullUrl);
            return client.focus();
          }
        }
        // Otherwise open a fresh window
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});