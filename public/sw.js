/* ------------------------------------------------------------------ */
/*  ORDERLY SERVICE WORKER                                             */
/*                                                                      */
/*  Strategy:                                                           */
/*   - App shell cached individually (one failure never kills the batch) */
/*   - Static assets: stale-while-revalidate                           */
/*   - Supabase API calls: NEVER cached (always live network)          */
/*   - Navigation: network-first with a guaranteed Response fallback    */
/* ------------------------------------------------------------------ */

const CACHE_VERSION = 'orderly-v3';   // v3 — bump to force old cache purge
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
        // Cache each URL independently. If one fails (e.g. a 404 or a
        // redirect we can't follow), the rest still succeed.
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

  // Only handle GET — let everything else pass through
  if (request.method !== 'GET') return;

  // Never touch Supabase (database, auth, storage, realtime)
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return;
  }

  // Never touch cross-origin requests (WhatsApp, analytics, extensions)
  if (url.origin !== self.location.origin) return;

  // Skip Vite dev artifacts (HMR) — belt and braces
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@')) return;

  /* ---- SPA navigation: network-first, ALWAYS a valid Response ---- */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);

          // Cache successful navigations for the next offline visit
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('/', clone)).catch(() => {});
          }

          return networkResponse;
        } catch {
          // Network failed → try the cached shell
          const cached = await caches.match('/');
          if (cached) return cached;

          // Absolute last resort: a synthetic Response we always own
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
        .catch(() => cached); // if network fails and we have cache, use it

      return cached || networkFetch;
    })
  );
});