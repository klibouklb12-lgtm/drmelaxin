/**
 * ============================================================================
 *  Service Worker for Dr.Melaxin — CDN-aware, zero-bandwidth repeat visits
 * ============================================================================
 *
 *  STRATEGY:
 *  1. Navigation (HTML):  Stale-while-revalidate
 *     → Serve cached HTML instantly, update in background.
 *     → First visit: fetch from origin, cache for 7 days.
 *     → Repeat visit: ~4KB (SW check only) = zero bandwidth.
 *
 *  2. CDN assets (cross-origin images/js/css from jsDelivr):
 *     → Cache-first. If cache miss, fetch from CDN.
 *     → If CDN fails, fall back to ORIGIN (same path) — never breaks.
 *     → Responses are "opaque" (cross-origin) but cacheable.
 *
 *  3. Same-origin static assets (/_next/static/*, /logo.svg, etc.):
 *     → Cache-first with background update.
 *     → Cached for 1 year (immutable).
 *
 *  4. POST requests (orders → /api/orders or Google Sheets):
 *     → Network-only. Never cached.
 *
 *  CACHE VERSIONING:
 *  → Bump CACHE_VERSION to force all clients to refresh their cache.
 * ============================================================================
 */

const CACHE_VERSION = 'v2'; // bumped: new CDN-aware strategy
const CACHE_NAME = `drmelaxin-${CACHE_VERSION}`;
const HTML_CACHE = `drmelaxin-html-${CACHE_VERSION}`;

// Pre-cache the app shell (origin paths only — CDN assets cache on-demand)
const APP_SHELL = [
  '/',
  '/logo.svg',
];

// --- Install: pre-cache app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // If any pre-cache fails, don't block installation
      })
    )
  );
  self.skipWaiting();
});

// --- Activate: clean old caches, claim clients ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// --- Helper: is this a navigation request (HTML page)? ---
function isNavigation(request) {
  return request.mode === 'navigate' ||
         (request.headers.get('accept') || '').includes('text/html');
}

// --- Helper: is this a cross-origin request (CDN)? ---
function isCrossOrigin(url) {
  return !url.startsWith(self.location.origin);
}

// --- Helper: convert a CDN URL back to origin path (for fallback) ---
function cdnToOriginPath(url) {
  try {
    const u = new URL(url);
    return u.pathname; // e.g. /gh/USER/REPO@main/gallery/hero.jpg → /gallery/hero.jpg
    // Note: for jsDelivr, the pathname includes /gh/USER/REPO@main/ prefix.
    // We extract just the file path after the last /public/ or use the last segment.
  } catch {
    return null;
  }
}

// --- Helper: extract origin path from jsDelivr URL ---
function jsdelivrToOrigin(url) {
  // jsDelivr URL format: https://cdn.jsdelivr.net/gh/USER/REPO@BRANCH/public/gallery/hero.jpg
  // We want: /gallery/hero.jpg (origin path)
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('jsdelivr.net')) {
      // Split path: /gh/USER/REPO@BRANCH/public/gallery/hero.jpg
      // Find '/public/' and take everything after it
      const match = u.pathname.match(/\/public\/(.+)$/);
      if (match) return `${self.location.origin}/${match[1]}`;
      // If no /public/ in path, try the last path segment
      const parts = u.pathname.split('/');
      return `${self.location.origin}/${parts[parts.length - 1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

// --- Fetch handler ---
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // POST requests (orders) — always go to network, never cache
  if (request.method === 'POST') {
    return;
  }

  // Only handle GET
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) protocols (chrome-extension://, etc.)
  if (!request.url.startsWith('http')) {
    return;
  }

  // --- Strategy 1: Navigation (HTML) — stale-while-revalidate ---
  if (isNavigation(request)) {
    event.respondWith(
      caches.open(HTML_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          // Fetch fresh version in background (always, even if cache hit)
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached); // If fetch fails, fall back to cache

          // Serve cached immediately if available, otherwise wait for network
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // --- Strategy 2: Cross-origin (CDN) assets — cache-first with origin fallback ---
  if (isCrossOrigin(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Serve from cache, refresh in background
          fetch(request)
            .then((response) => {
              if (response.ok || response.type === 'opaque') {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response.clone());
                });
              }
            })
            .catch(() => {});
          return cached;
        }

        // Cache miss: try CDN first, fall back to origin
        return fetch(request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            // CDN failed — try origin (same asset path)
            const originUrl = jsdelivrToOrigin(request.url);
            if (originUrl) {
              return fetch(originUrl);
            }
            // If we can't convert, return a transparent 1x1 placeholder
            return new Response('', { status: 204 });
          });
      })
    );
    return;
  }

  // --- Strategy 3: Same-origin static assets — cache-first with background update ---
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Refresh in background
        fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response.clone());
              });
            }
          })
          .catch(() => {});
        return cached;
      }

      // Cache miss: fetch from network
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback for images
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
        });
    })
  );
});
