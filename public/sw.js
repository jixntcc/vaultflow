const CACHE_NAME = 'vaultflow-shell-v10';
const OFFLINE_URL = '/';
const SHELL_ASSETS = ['/', '/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => undefined)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function rewriteNavigation(response) {
  if (!response || !response.ok) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = await response.text();
  const injection = '<link rel="stylesheet" href="/css/habit-calendar.css?v=v10"><link rel="stylesheet" href="/css/habit-modal.css?v=v10"><script src="/js/core/transaction-fast-path.js?v=v10"></script><script src="/js/core/frontend-restoration.js?v=v10"></script><script src="/js/core/goal-submit-guard.js?v=v10"></script><script src="/js/core/habit-calendar.js?v=v10"></script><script src="/js/core/habit-calendar-anchor.js?v=v10"></script><script src="/js/core/habit-modal.js?v=v10"></script>';
  if (!html.includes('habit-calendar.js')) html = html.replace('</head>', injection + '</head>');
  return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(rewriteNavigation).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok && request.method === 'GET') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(request)));
});