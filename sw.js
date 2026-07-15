// ============================================================================
// Service Worker — PWA (offline) + notificaciones push
//
// Estrategias de caché:
//   - App shell (HTML/CSS/JS propios): cache-first (carga instantánea y offline).
//   - Datos de Supabase (/rest/): network-first con respaldo en caché
//     (offline muestra los últimos reportes vistos).
//   - CDNs, fuentes y tiles del mapa: cache-first (se guardan al usarse).
// ============================================================================

const VERSION = 'patitas-v6';

// Archivos propios que se precachean al instalar.
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/styles.css',
  './js/app.js', './js/config.js', './js/supabase.js', './js/demo.js', './js/data.js',
  './js/constants.js', './js/map.js', './js/filters.js', './js/reportCard.js', './js/ui.js',
  './js/auth.js', './js/imageCompress.js', './js/storage.js', './js/validation.js',
  './js/reportForm.js', './js/matching.js', './js/historias.js', './js/pwa.js', './js/alerts.js',
  './js/support.js',
  './assets/icon.svg',
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

  // Archivos propios y datos de Supabase: RED PRIMERO (siempre lo más fresco),
  // con la caché solo como respaldo cuando no hay conexión.
  if (mismoOrigen || datosSupabase) {
    e.respondWith(networkFirst(req));
    return;
  }

  // CDNs, fuentes y tiles del mapa: CACHÉ PRIMERO (rara vez cambian).
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
    // Sin conexión y sin caché exacta: si es una navegación, servimos la app.
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./'));
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    // Guardamos respuestas válidas y opacas (tiles/fuentes) para uso offline
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch {
    // Si es una navegación sin red, devolvemos la app cacheada
    if (req.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  }
}

// ---- Notificaciones push --------------------------------------------------
self.addEventListener('push', (e) => {
  const d = (() => { try { return e.data?.json() ?? {}; } catch { return {}; } })();
  const title = d.title || 'Busca Huellitas';
  const opciones = {
    body: d.body || 'Hay un nuevo reporte cerca de tu zona.',
    icon: 'assets/icon.svg',
    badge: 'assets/icon.svg',
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
      // Si ya hay una ventana abierta, la enfocamos; si no, abrimos una nueva.
      const win = wins.find((w) => 'focus' in w);
      if (win) { win.navigate(url); return win.focus(); }
      return clients.openWindow(url);
    })
  );
});
