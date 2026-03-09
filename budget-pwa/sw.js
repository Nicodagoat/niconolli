/* ══════════════════════════════════════════
   PAIRLY — Service Worker v4
   Strategy: Cache-first for assets, with
   offline expense queue for submissions.
══════════════════════════════════════════ */

const CACHE_NAME        = 'pairly-v4';
const OFFLINE_QUEUE_KEY = 'pairly_offline_queue';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
];

// ── Install: pre-cache all static assets ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for our assets, network-first for everything else ──────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        // Not in cache — try network
        return fetch(event.request)
          .then(response => {
            // Cache successful GET responses for our assets
            if (
              response.ok &&
              event.request.method === 'GET' &&
              (url.pathname.match(/\.(html|css|js|json|svg|png|ico|woff2?)$/) ||
               url.pathname === '/' ||
               url.pathname.endsWith('/'))
            ) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback: serve index.html for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            // Return empty response for other requests
            return new Response('', { status: 503, statusText: 'Offline' });
          });
      })
  );
});

// ── Background Sync: flush offline expense queue ──────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-expenses') {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  // The app stores expenses in localStorage directly (works offline).
  // This sync event is a hook for future server-sync integration.
  // Notify the client that sync fired (for UX feedback).
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

// ── Push notifications (for recurring expense reminders) ──────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pairly', {
      body:    data.body  || 'Time to log your expenses!',
      icon:    './icon.svg',
      badge:   './icon.svg',
      tag:     'pairly-reminder',
      renotify: true,
      data:    { url: './' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then(clients => {
        if (clients.length) {
          clients[0].focus();
        } else {
          self.clients.openWindow('./');
        }
      })
  );
});
