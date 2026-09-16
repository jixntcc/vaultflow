const CACHE_NAME = 'vaultflow-shell-v20';
const OFFLINE_URL = '/';
const SHELL_ASSETS = ['/', '/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// The service worker is a cache layer only. The current UI assets are loaded
// explicitly by store.js so first-load, localhost, incognito and controlled
// sessions all receive the same application shell. Keeping HTML untouched
// also prevents old/new interfaces from appearing depending on SW state.
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && request.method === 'GET') {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, copy))
          .catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request))
  );
});
