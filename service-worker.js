// service-worker.js

const CACHE_VERSION = 'v1';
const CACHE_NAME = `attendance-app-${CACHE_VERSION}`;

// List of resources to precache
const ASSETS = [
  '/',                // serve index.html
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: cache shell & offline page
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: navigation → cached index.html, others → cache-first
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) Handle page navigations (refresh, address bar, pull-to-refresh)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then(cachedShell => {
          return cachedShell || fetch(request);
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // 2) Other GET requests (assets) — cache-first, then network, then offline.html
  if (request.method === 'GET' && url.origin === location.origin) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                const copy = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
              }
              return networkResponse;
            })
            .catch(() => caches.match('/offline.html'));
        })
    );
  }
});

// Optional: force waiting SW to activate immediately
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
