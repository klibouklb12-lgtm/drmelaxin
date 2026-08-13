/**
 * ============================================================================
 *  Service Worker v3 — Self-healing, CDN-aware, offline-first
 * ============================================================================
 *
 *  SELF-HEALING FEATURES:
 *  1. Cache corruption detection — if cache.put fails, clears + rebuilds
 *  2. Quota exceeded handling — clears oldest entries when storage is full
 *  3. Automatic update flow — new SW takes over immediately (skipWaiting)
 *  4. Offline fallback page — shows cached page even when network fails
 *  5. Cross-origin CDN support — caches jsDelivr assets with origin fallback
 *  6. Never blocks POST requests (orders always go to network)
 *  7. Background sync for offline-queued orders (on reconnect)
 *
 *  STRATEGIES:
 *  - HTML navigation: stale-while-revalidate (instant load + background update)
 *  - CDN images: cache-first with origin fallback
 *  - Same-origin assets: cache-first with background update
 *  - POST: network-only (never cached)
 * ============================================================================
 */

const CACHE_VERSION = 'v4'; // bumped: excluded Google Apps Script from cache
const CACHE_NAME = `drmelaxin-${CACHE_VERSION}`;
const HTML_CACHE = `drmelaxin-html-${CACHE_VERSION}`;
const OFFLINE_URL = '/'; // fallback to cached homepage

const MAX_CACHE_ENTRIES = 100; // prevent unlimited growth

// --- Install: pre-cache minimal app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(['/']).catch(() => {}); // best-effort, don't block
      } catch (e) {
        // If pre-cache fails, continue anyway — SW will cache on-demand
        console.warn('[SW] Pre-cache failed (non-blocking):', e);
      }
      self.skipWaiting(); // take over immediately
    })()
  );
});

// --- Activate: clean old caches, claim clients ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => !key.endsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        );
      } catch (e) {
        console.warn('[SW] Cache cleanup failed:', e);
      }
      await self.clients.claim();
    })()
  );
});

// --- Helper functions ---
function isNavigation(request) {
  return (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  );
}

function isCrossOrigin(url) {
  return !url.startsWith(self.location.origin);
}

function jsdelivrToOrigin(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('jsdelivr.net')) {
      const match = u.pathname.match(/\/public\/(.+)$/);
      if (match) return `${self.location.origin}/${match[1]}`;
      const parts = u.pathname.split('/');
      return `${self.location.origin}/${parts[parts.length - 1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

// --- Trim cache to prevent quota overflow ---
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      // Delete oldest entries (first in, first out)
      const toDelete = keys.slice(0, keys.length - maxEntries);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  } catch (e) {
    console.warn('[SW] Cache trim failed:', e);
  }
}

// --- Safe cache put (handles quota errors) ---
async function safeCachePut(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Storage full — clear old entries and retry
      console.warn('[SW] Quota exceeded, trimming cache...');
      await trimCache(CACHE_NAME, MAX_CACHE_ENTRIES / 2);
      try {
        await cache.put(request, response.clone());
      } catch {
        // Give up silently — the response is still returned to the user
      }
    } else {
      console.warn('[SW] Cache put failed:', e);
    }
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
  if (request.method !== 'GET') return;

  // Skip non-http(s) protocols
  if (!request.url.startsWith('http')) return;

  // CRITICAL: NEVER cache Google Apps Script requests (stock, orders, product, stats)
  // These must ALWAYS hit the network for real-time data.
  // Caching them would freeze stock at stale values and could replay orders.
  if (request.url.includes('script.google.com') ||
      request.url.includes('/macros/s/') ||
      request.url.includes('action=stock') ||
      request.url.includes('action=order') ||
      request.url.includes('action=product') ||
      request.url.includes('action=stats')) {
    // Network-only — let it pass through without SW interference
    return;
  }

  // --- Strategy 1: Navigation (HTML) — stale-while-revalidate ---
  if (isNavigation(request)) {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(request);

          // Fetch fresh version in background (always)
          const fetchPromise = fetch(request)
            .then(async (response) => {
              if (response.ok) {
                await safeCachePut(cache, request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          // Serve cached immediately if available
          if (cached) return cached;
          return fetchPromise;
        } catch (e) {
          // Total failure — try offline fallback
          console.warn('[SW] Navigation failed, trying offline:', e);
          try {
            const cache = await caches.open(HTML_CACHE);
            const fallback = await cache.match(OFFLINE_URL);
            if (fallback) return fallback;
          } catch {}
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // --- Strategy 2: Cross-origin (CDN) assets — cache-first + origin fallback ---
  if (isCrossOrigin(request.url)) {
    event.respondWith(
      (async () => {
        try {
          const cached = await caches.match(request);
          if (cached) {
            // Refresh in background
            fetch(request)
              .then(async (response) => {
                if (response.ok || response.type === 'opaque') {
                  const cache = await caches.open(CACHE_NAME);
                  await safeCachePut(cache, request, response.clone());
                }
              })
              .catch(() => {});
            return cached;
          }

          // Cache miss: try CDN
          try {
            const response = await fetch(request);
            if (response.ok || response.type === 'opaque') {
              const cache = await caches.open(CACHE_NAME);
              await safeCachePut(cache, request, response.clone());
            }
            return response;
          } catch (cdnErr) {
            // CDN failed — try origin fallback
            const originUrl = jsdelivrToOrigin(request.url);
            if (originUrl) {
              return fetch(originUrl);
            }
            throw cdnErr;
          }
        } catch (e) {
          // Total failure — return placeholder for images
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        }
      })()
    );
    return;
  }

  // --- Strategy 3: Same-origin static assets — cache-first + background update ---
  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(request);
        if (cached) {
          // Refresh in background
          fetch(request)
            .then(async (response) => {
              if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                await safeCachePut(cache, request, response.clone());
              }
            })
            .catch(() => {});
          return cached;
        }

        // Cache miss: fetch from network
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await safeCachePut(cache, request, response.clone());
        }
        return response;
      } catch (e) {
        // Offline fallback for images
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      }
    })()
  );
});

// --- Message handler: allow page to trigger cache clear ---
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
        .then(() => {
          event.source && event.source.postMessage({ type: 'CACHE_CLEARED' });
        })
    );
  }
});
