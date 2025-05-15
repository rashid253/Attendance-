// service-worker.js

const CACHE_VERSION = 'v3';
const CACHE_NAME = `attendance-app-${CACHE_VERSION}`;
const PRECACHE = [
  '/',               // serves index.html
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url  = new URL(req.url);

  // 1) Handle HTML navigations (user typing URL, link clicks, pull-to-refresh)
  if (req.mode === 'navigate' ||
      (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    e.respondWith(
      fetch(req)
        .then(res => {
          // update cached shell for next offline
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // 2) For same-origin static assets: cache-first, then network, then offline.html
  if (req.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req)
          .then(res => {
            if (!res.ok) throw new Error('Network error');
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
            return res;
          })
          .catch(() => caches.match('/offline.html'));
      })
    );
  }
});

// Optional: skipWaiting via postMessage
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
