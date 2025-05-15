const CACHE_NAME = 'attendance-app-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',               // optional: only used for non-navigation failover
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
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

// Fetch: App Shell for navigations, cache-first for others
self.addEventListener('fetch', event => {
  // 1) Navigation requests → app shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update the cache in the background
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          // Always serve the cached index.html for navigations
          caches.match('/index.html')
        )
    );
    return;
  }

  // 2) Other requests → cache-first, then network, then offline.html
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(networkResp => {
            // Cache the new resource
            const respCopy = networkResp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, respCopy));
            return networkResp;
          });
      })
      .catch(() =>
        // Optional: show a generic offline page for images/API calls
        caches.match('/offline.html')
      )
  );
});

// Optional: listen for skipWaiting message to activate new SW immediately
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
