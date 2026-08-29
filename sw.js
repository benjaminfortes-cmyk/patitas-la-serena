// Service Worker — PWA (offline) + notificaciones push

const VERSION = 'patitas-v29';

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/styles.css',
  './js/app.js', './js/config.js', './js/supabase.js', './js/demo.js', './js/data.js',
  './js/constants.js', './js/map.js', './js/filters.js', './js/reportCard.js', './js/ui.js',
  './js/auth.js', './js/imageCompress.js', './js/storage.js', './js/validation.js',
  './js/reportForm.js', './js/matching.js', './js/historias.js', './js/pwa.js', './js/alerts.js',
  './js/support.js', './js/guia.js', './js/lightbox.js', './js/stats.js', './js/novedades.js',
  './js/poster.js', './js/appMode.js', './js/appGate.js', './js/cuenta.js',
  './js/revisiones.js', './js/basemap.js',
  './assets/icon.svg',
  './assets/icons/icon-192.png', './assets/icons/badge-96.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;  // no cacheamos POST/PUT (login, RPC, etc.)

  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;
  const datosSupabase = url.hostname.endsWith('supabase.co') && url.pathname.includes('/rest/');

  if (mismoOrigen || datosSupabase) {
    e.respondWith(networkFirst(req));
    return;
  }

  e.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./'));
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  if (cached && req.mode === 'cors' && cached.type === 'opaque') {
    try {
      const res = await fetch(req);
      if (res && res.ok) { cache.put(req, res.clone()); return res; }
    } catch { /* sin red: devolvemos lo que había */ }
    return cached;
  }
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch {
    if (req.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  }
}

self.addEventListener('push', (e) => {
  const d = (() => { try { return e.data?.json() ?? {}; } catch { return {}; } })();
  const title = d.title || 'Busca Huellitas';
  const opciones = {
    body: d.body || 'Hay un nuevo reporte cerca de tu zona.',
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/badge-96.png',
    data: { url: d.url || './' },
    vibrate: [80, 40, 80],
  };
  e.waitUntil(self.registration.showNotification(title, opciones));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => 'focus' in w);
      if (win) { win.navigate(url); return win.focus(); }
      return clients.openWindow(url);
    })
  );
});
