// ============================================================================
// Alertas por cercanía (Web Push).
//
// El usuario elige un punto (ej: su casa) y un radio (1/3/5 km). Cuando se
// publique un reporte nuevo dentro de ese radio, recibe una notificación push.
//
// El envío real lo hace la Edge Function `send-push` en el servidor; aquí solo
// guardamos la suscripción del navegador y la zona elegida.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { getUser, signIn } from './auth.js';
import { VAPID_PUBLIC_KEY, MAP_CENTER, MAP_ZOOM } from './config.js';
import { toast } from './ui.js';

export function initAlertas() {
  window.openAlertas = abrir;
}

let mapa, marcador, circulo;
const seleccion = { lat: MAP_CENTER[0], lng: MAP_CENTER[1], radius: 3000 };

function abrir() {
  if (isConfigured && !getUser()) {
    toast('Inicia sesión para activar alertas.', 'info');
    return signIn();
  }

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Alertas por zona">
      <div class="matches__head">
        <h3>Avísame de reportes en mi zona 🔔</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Marca tu punto (ej: tu casa) y elige el radio. Te avisaremos de reportes nuevos ahí.</p>
      <div id="alert-map" class="form-map"></div>
      <div class="seg seg--sm" role="group" aria-label="Radio" style="margin:12px 0">
        <button type="button" class="seg__btn" data-radio="1000">1 km</button>
        <button type="button" class="seg__btn seg__btn--active" data-radio="3000">3 km</button>
        <button type="button" class="seg__btn" data-radio="5000">5 km</button>
      </div>
      <button class="btn btn--primary" id="alert-activar" style="width:100%">
        <i class="ph ph-bell"></i> Activar alertas
      </button>
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => { overlay.remove(); mapa = null; };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  // Mini-mapa para elegir el centro
  setTimeout(() => {
    mapa = L.map('alert-map').setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    marcador = L.marker(MAP_CENTER, { draggable: true }).addTo(mapa);
    circulo = L.circle(MAP_CENTER, { radius: seleccion.radius, color: '#FF6F61', fillOpacity: 0.12 }).addTo(mapa);

    const fijar = (lat, lng) => {
      seleccion.lat = lat; seleccion.lng = lng;
      marcador.setLatLng([lat, lng]); circulo.setLatLng([lat, lng]);
    };
    marcador.on('dragend', () => { const p = marcador.getLatLng(); fijar(p.lat, p.lng); });
    mapa.on('click', (e) => fijar(e.latlng.lat, e.latlng.lng));
  }, 50);

  // Selector de radio
  overlay.querySelectorAll('[data-radio]').forEach((b) => {
    b.addEventListener('click', () => {
      overlay.querySelectorAll('[data-radio]').forEach((x) => x.classList.remove('seg__btn--active'));
      b.classList.add('seg__btn--active');
      seleccion.radius = Number(b.dataset.radio);
      circulo?.setRadius(seleccion.radius);
    });
  });

  overlay.querySelector('#alert-activar').addEventListener('click', () => activar(cerrar));
}

async function activar(cerrar) {
  // Pide permiso de notificaciones
  if (!('Notification' in window)) return toast('Tu navegador no soporta notificaciones.', 'error');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return toast('Necesitas permitir las notificaciones.', 'info');

  // ---- MODO DEMO: muestra una notificación de ejemplo ----
  if (!isConfigured) {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Patitas La Serena 🐾', {
      body: 'Así se verán tus alertas cuando haya un reporte en tu zona.',
      icon: 'assets/icon.svg',
    });
    toast('Alertas activadas (demo) ✅', 'exito');
    return cerrar();
  }

  try {
    // Suscribe este navegador a Web Push con la clave pública VAPID
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const j = sub.toJSON();

    // Guarda el endpoint del navegador (una fila por dispositivo)
    await supabase.from('push_subscriptions').upsert({
      user_id: getUser().id,
      endpoint: sub.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: 'endpoint' });

    // Guarda la zona de alerta (el centro lo arma el servidor con el offset 0)
    const { error } = await supabase.rpc('add_alert', {
      p_lat: seleccion.lat, p_lng: seleccion.lng, p_radius_m: seleccion.radius,
    });
    if (error) throw new Error(error.message);

    toast('¡Listo! Te avisaremos de reportes en tu zona 🔔', 'exito');
    cerrar();
  } catch (err) {
    toast(err.message || 'No se pudo activar. ¿Configuraste las claves VAPID?', 'error');
  }
}

// Convierte la clave VAPID (base64url) al formato que pide el navegador.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
