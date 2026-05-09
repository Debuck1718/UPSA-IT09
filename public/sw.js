const CACHE_NAME = 'evantrahub-v4'; // Incremented version
const OFFLINE_URL = '/offline.html';

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

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
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
      .catch(() => caches.match(req).then(res => res || caches.match(OFFLINE_URL)))
  );
});

// --- UPDATED PUSH LISTENER ---
self.addEventListener('push', (event) => {
  let data = {
    title: 'Evantrahub Hub',
    content: 'Check the dashboard for updates.',
    url: '/dashboard-modern.html', // Updated to your new dashboard path
    type: 'general'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.content = event.data.text();
    }
  }

  let notificationTitle = data.title;
  let targetUrl = data.url;

  if (data.type === 'forum') {
    notificationTitle = `💬 New Post: ${data.title}`;
  } else if (data.type === 'announcement') {
    notificationTitle = `📢 Notice: ${data.title}`;
  }

  const options = {
    body: data.content,
    icon: '/images/web-app-manifest-192x192.png',
    badge: '/images/favicon-96x96.png',
    vibrate: [200, 100, 200],
    data: { url: targetUrl },
    tag: data.type || 'default',
    renotify: true,
    requireInteraction: true, // Makes it stay until clicked (like Facebook)
    actions: [
      { action: 'open', title: 'View Now' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  // Removed the 'if permission' check to prevent internal SW sync issues
  event.waitUntil(
    self.registration.showNotification(notificationTitle, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = new URL(event.notification.data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});