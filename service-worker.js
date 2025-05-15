// service-worker.js

const CACHE_VERSION = 'v1';
const CACHE_NAME = `attendance-app-${CACHE_VERSION}`;
const PRECACHE_ASSETS = [
  '/',                // root (index.html)
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: cache shell + offline page, then activate immediately
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches, take control of clients
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for navigation, cache-first for assets
self.addEventListener('fetch', evt => {
  const req = evt.request;

  // A) Navigation requests (HTML pages)
  if (req.mode === 'navigate' ||
      (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    evt.respondWith(
      fetch(req)
        .then(networkRes => {
          // update cache
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return networkRes;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // B) Static assets (CSS/JS/Images/etc)
  if (req.method === 'GET') {
    evt.respondWith(
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

// Listen for skipWaiting message
self.addEventListener('message', evt => {
  if (evt.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
