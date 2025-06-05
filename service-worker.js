// service-worker.js
// -----------------
// A simple Service Worker for offline support and asset caching. It
// pre-caches the core application shell (HTML, CSS, JS, and key static assets),
// and serves them from cache when offline. Adjust CACHE_NAME and URLs as needed.

const CACHE_NAME = "attendance-app-v1";
const FILES_TO_CACHE = [
  "/",                  // The root HTML (index.html)
  "/index.html",
  "/login.html",
  "/style.css",
  "/firebase-config.js",
  "/auth.js",
  "/setup.js",
  "/app.js",
  "/manifest.json",

  // Firebase SDKs
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js",
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js",

  // IIFE libraries
  "https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval-iife.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
];

// Install event: Pre-cache core files
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching assets");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches if CACHE_NAME changes
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activate");
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Serve cached assets or fetch from network
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestURL = new URL(event.request.url);
  // For same-origin navigation requests, serve index.html (offline fallback)
  if (requestURL.origin === location.origin && requestURL.pathname === "/") {
    event.respondWith(
      caches.match("/index.html").then((response) => response || fetch(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        return cachedResponse;
      }
      // Otherwise fetch from network and cache the result
      return caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            // If valid response, clone and put in cache
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // If network fails and request is for an HTML page, serve offline fallback
            if (event.request.headers.get("accept").includes("text/html")) {
              return caches.match("/index.html");
            }
          });
      });
    })
  );
});
