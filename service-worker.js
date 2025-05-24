// service-worker.js
const CACHE_NAME = 'attendance-app-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/teacher.html',
  '/principal.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/firebase.js',
  '/auth.js',
  '/api.js',
  '/notify.js',
  '/manifest.json',
  // plus any icons you add
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(res => res || fetch(event.request))
  );
});
