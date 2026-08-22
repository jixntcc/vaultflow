const CACHE_NAME = 'vaultflow-shell-v4';
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
  const injection = '<script src="/js/core/frontend-restoration.js?v=v4"></script>';
  if (!html.includes('frontend-restoration.js')) html = html.replace('</body>', injection + '</body>');
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
