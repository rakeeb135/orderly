/* ------------------------------------------------------------------ */
/*  ORDERLY SERVICE WORKER                                             */
/*                                                                      */
/*  Strategy:                                                           */
/*   - App shell (HTML, icons, manifest) → cached, installable offline */
/*   - Static assets (JS, CSS, images) → stale-while-revalidate        */
/*   - Supabase API calls → NEVER cached (always live network)         */
/*   - Navigation requests → network-first with offline fallback       */
/* ------------------------------------------------------------------ */

const CACHE_VERSION = 'orderly-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

/* ---------------------------------------------------------------- */
/*  Install: pre-cache app shell                                     */
/* ---------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-cache failed (non-fatal):', err);
      })
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

  // Never touch Supabase requests (database, auth, storage, realtime)
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return;
  }

  // Never touch cross-origin requests (WhatsApp, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip Vite dev artifacts (HMR, /src/, etc.) — belt and braces
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@')) return;

  // SPA navigation → network-first, fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets → cache-first, refresh in background (SWR)
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});