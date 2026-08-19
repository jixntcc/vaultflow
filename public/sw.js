const CACHE_NAME = 'vaultflow-shell-v3';
const OFFLINE_URL = '/';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable-192.svg',
  '/icons/icon-maskable-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  const isOperationalEndpoint =
    url.pathname === '/health' ||
    url.pathname === '/health/ready' ||
    url.pathname === '/health/metrics';

  if (url.pathname.startsWith('/api/') || isOperationalEndpoint || req.headers.get('authorization')) {
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type === 'opaque') return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type !== 'VF_LOCAL_NOTIFY') return;
  const payload = msg.payload || {};
  self.registration.showNotification(payload.title || 'VaultFlow', {
    body: payload.body || 'You have a new finance reminder.',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    data: payload.data || { page: 'dashboard' },
    tag: payload.data?.tag || 'vf-local-reminder',
    renotify: false,
    actions: [
      { action: 'open', title: 'Open VaultFlow' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(payload.title || 'VaultFlow', {
      body: payload.body || 'Your finance update is ready.',
      tag: payload.data?.tag || 'vf-push',
      renotify: false,
      actions: [
        { action: 'open', title: 'Open VaultFlow' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      data: payload.data || { page: 'dashboard' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const page = event.notification?.data?.page || 'dashboard';
  const targetUrl = `/${page === 'dashboard' ? '' : `#${page}`}`;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'VF_NAVIGATE', page });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});


// Phase 3G — resilient notification click / push handling.
// Existing push handler remains authoritative; these listeners only add
// safe fallbacks for malformed payloads and focus/open behavior.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || '/#habits';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of clientsList) {
      if ('focus' in client) {
        try {
          await client.focus();
          if ('navigate' in client && target) await client.navigate(target);
          return;
        } catch (_) {}
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    // The next foreground visit will reconcile the browser-generated
    // subscription with the backend. We intentionally do not fabricate
    // a subscription here because browsers differ in whether the new
    // subscription is exposed to this event.
    return true;
  })());
});
