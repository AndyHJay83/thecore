const CACHE_NAME = 'word-filter-v12';
const VERSION = 'v12';

// Install event - skip waiting immediately, don't pre-cache
self.addEventListener('install', (event) => {
  console.log('Service Worker installing, version:', VERSION);
  // Skip waiting to activate immediately
  event.waitUntil(
    // Delete all old caches first
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting old cache on install:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up ALL caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating, version:', VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete ALL caches to force fresh fetch
      console.log('Clearing all caches on activate:', cacheNames);
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    }).then(() => {
      // Send message to all clients to reload
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ 
            type: 'SW_ACTIVATED', 
            cacheName: CACHE_NAME,
            version: VERSION 
          });
        });
      });
    })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Fetch event - network first, never serve stale cache for app files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppFile = url.pathname.includes('/coretest/') && 
                    (url.pathname.endsWith('.html') || 
                     url.pathname.endsWith('.css') || 
                     url.pathname.endsWith('.js') ||
                     url.pathname.endsWith('/') ||
                     url.pathname === '/coretest/');
  
  if (isAppFile) {
    // Network first - NEVER use cache for app files, always fetch fresh
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Cache-Bust': Date.now().toString()
        }
      })
        .then((response) => {
          // Don't cache app files at all - always fetch fresh
          // This ensures PWA always gets latest version
          return response;
        })
        .catch(() => {
          // If network fails completely, return error
          // Don't serve stale cache for app files
          return new Response('Network error - please check connection', { 
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
  } else {
    // For other resources (images, fonts, etc.), use cache first
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseClone);
                  });
              }
              return response;
            });
        })
    );
  }
}); 