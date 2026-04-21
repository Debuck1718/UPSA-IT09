const CACHE_NAME = 'acadex-v3';
const OFFLINE_URL = '/offline.html';

// Corrected for your UPSA-IT09 root structure
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/profile.html',
  '/resources.html',
  '/forum.html',
  '/style.css',
  '/api.js',
  '/profile.js',
  '/images/web-app-manifest-192x192.png',
  '/images/web-app-manifest-512x512.png',
  '/images/favicon-96x96.png',
  OFFLINE_URL
];

// --- INSTALL: Pre-cache core assets ---
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Pre-caching core shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// --- ACTIVATE: Clean up old versions ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});


self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Don't intercept API calls or cross-origin requests
  if (req.method !== 'GET' || req.url.includes('/api/') || !req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(req).then(res => res || caches.match(OFFLINE_URL));
      })
  );
});

// --- PUSH: Smart Multi-Channel Notifications ---
self.addEventListener('push', (event) => {
  let data = {
    title: 'Acadex Hub',
    content: 'Check the dashboard for updates.',
    url: '/index.html',
    type: 'general'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.content = event.data.text();
    }
  }

  // Dynamic Logic based on notification type
  let notificationTitle = data.title;
  let targetUrl = data.url;

  if (data.type === 'forum') {
    notificationTitle = `💬 New Post: ${data.title}`;
    targetUrl = '/forum.html';
  } else if (data.type === 'announcement') {
    notificationTitle = `📢 Notice: ${data.title}`;
    targetUrl = '/announcements.html';
  }

  const options = {
    body: data.content,
    icon: '/images/web-app-manifest-192x192.png',
    badge: '/images/web-app-manifest-192x192.png',
    vibrate: [100, 50, 100],
    data: { url: targetUrl },
    tag: data.type, 
    renotify: true  
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, options)
  );
});

// --- NOTIFICATION CLICK: Intelligent Window Focus ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if the user already has the tab open
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});