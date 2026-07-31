const CACHE_NAME = 'mis-restaurantes-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
  );
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const url = firstString(formData.get('url'));
  const text = firstString(formData.get('text'));
  const sharedInput = [url, text].filter(Boolean).join('\n');
  const destination = new URL('/', self.location.origin);

  if (sharedInput) destination.searchParams.set('share_url', sharedInput);
  return Response.redirect(destination.toString(), 303);
}

function firstString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
