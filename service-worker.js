// service-worker.js

const CACHE_VERSION = 'v2';
const CACHE_NAME = `attendance-app-${CACHE_VERSION}`;
const PRECACHE_ASSETS = [
  '/',                // root → index.html
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', evt => {
  console.log('[SW] Install');
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  console.log('[SW] Activate');
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(oldKey => {
            console.log('[SW] Deleting old cache:', oldKey);
            return caches.delete(oldKey);
          })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  const req = evt.request;
  const accept = req.headers.get('accept') || '';

  // 1) HTML navigations: try network → fallback to offline.html
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    evt.respondWith(
      fetch(req)
        .then(res => {
          // update cache for next time
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          console.log('[SW] Fetched & cached HTML:', req.url);
          return res;
        })
        .catch(err => {
          console.log('[SW] Network failed for navigation, serving offline page');
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // 2) Other GET requests: cache-first → network → offline.html
  if (req.method === 'GET') {
    evt.respondWith(
      caches.match(req).then(cached => {
        if (cached) {
          console.log('[SW] Cache hit:', req.url);
          return cached;
        }
        console.log('[SW] Cache miss, fetching:', req.url);
        return fetch(req)
          .then(res => {
            if (!res || !res.ok) throw new Error('Network response not OK');
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
            console.log('[SW] Fetched & cached asset:', req.url);
            return res;
          })
          .catch(err => {
            console.log('[SW] Fetch failed, serving offline page for:', req.url);
            return caches.match('/offline.html');
          });
      })
    );
  }
});

// Optional: allow forcing activation of new SW
self.addEventListener('message', evt => {
  if (evt.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
});
