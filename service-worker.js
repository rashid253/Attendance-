// Updated service-worker.js
// - Added versioning
// - Ensured offline.html fallback for navigations and other requests
// - Included activation cleanup

const CACHE_NAME = 'attendance-app-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: Cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Serve from cache, fallback to network, offline.html on failure
self.addEventListener('fetch', event => {
  // For navigation requests, try network first, then cache, then offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache for navigations
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('/index.html')
          .then(cached => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // For non-navigation, try cache, then network, then offline
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached ||
        fetch(event.request)
          .then(networkResp => {
            // Cache new resource
            const respCopy = networkResp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, respCopy));
            return networkResp;
          })
      )
      .catch(() => caches.match('/offline.html'))
  );
});

// Listen for skipWaiting message to update immediately
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
