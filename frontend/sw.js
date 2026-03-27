// Service Worker for caching static assets
const CACHE_NAME = 'protexam-v1.0.0';
const STATIC_CACHE_URLS = [
  '/',
  '/student/',
  '/student/index.html',
  '/student/css/styles.css',
  '/student/js/config.js',
  '/student/js/antiCheating.js',
  '/student/js/examInterface.js',
  '/login.html',
  '/organizer/',
  '/organizer/index.html'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then(response => {
            // Don't cache API calls or external resources
            if (!event.request.url.includes('/api/') &&
                event.request.url.startsWith(self.location.origin)) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            return response;
          });
      })
      .catch(() => {
        // Return offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/student/index.html');
        }
      })
  );
});