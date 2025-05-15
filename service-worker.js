// service-worker.js

// CHANGE THIS to bust caches when you update your SW:
const CACHE_VERSION = 'v1';
const CACHE_NAME = `attendance-app-${CACHE_VERSION}`;

// List all resources you want to precache:
const PRECACHE_ASSETS = [
  '/',                   // root → serves index.html
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: precache the shell and offline page
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches and take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', event => {
  const req = event.request;

  // 1) Navigation requests → network-first, fallback to index.html
  if (req.mode === 'navigate' ||
      (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          // Update cache for next offline use
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return networkRes;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 2) Other GET requests (CSS/JS/images) → cache-first, then network, then offline.html
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cachedRes => {
        if (cachedRes) return cachedRes;

        return fetch(req)
          .then(networkRes => {
            if (networkRes.ok) {
              const copy = networkRes.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
            }
            return networkRes;
          })
          .catch(() => caches.match('/offline.html'));
      })
    );
  }
});

// Listen for a “skip waiting” message to immediately activate new SW
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
