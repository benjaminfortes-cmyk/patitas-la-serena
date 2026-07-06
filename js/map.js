// ============================================================================
// Mapa Leaflet: inicialización, marcadores por tipo y clustering.
// Usa la variable global `L` cargada por CDN en index.html.
// ============================================================================
import { MAP_CENTER, MAP_ZOOM } from './config.js';
import { KIND_META, ANIMAL_META } from './constants.js';

let map;
let clusterGroup;

// Crea el ícono de un marcador: pin con el color del estado y el ícono del animal.
function crearIcono(report) {
  const color = KIND_META[report.kind]?.color ?? '#888';
  const icono = ANIMAL_META[report.animal_type]?.icon ?? 'ph-paw-print';
  const resuelto = report.lifecycle === 'resuelto';

  const html = `
    <div class="pin ${resuelto ? 'pin--resuelto' : ''}" style="--pin: ${color}">
      <span class="pin__icon"><i class="ph-fill ${resuelto ? 'ph-heart' : icono}"></i></span>
    </div>`;

  return L.divIcon({
    html,
    className: 'pin-wrapper',
    iconSize: [40, 48],
    iconAnchor: [20, 46],   // punta del pin
    popupAnchor: [0, -44],
  });
}

// Inicializa el mapa centrado en La Serena.
export function initMap() {
  map = L.map('map', { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  // Agrupa marcadores cercanos en clusters (Leaflet.markercluster).
  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    showCoverageOnHover: false,
  });
  map.addLayer(clusterGroup);

  return map;
}

// Pinta (o repinta) los reportes en el mapa. `onSelect` se llama al hacer click.
export function renderReports(reports, onSelect) {
  clusterGroup.clearLayers();

  reports.forEach((r) => {
    if (r.lat == null || r.lng == null) return;
    const marker = L.marker([r.lat, r.lng], {
      icon: crearIcono(r),
      keyboard: true,
      title: r.pet_name || r.breed || 'Reporte',
      // Animación sutil de aparición
      riseOnHover: true,
    });
    marker.on('click', () => onSelect?.(r));
    marker.on('keypress', (e) => {
      if (e.originalEvent.key === 'Enter') onSelect?.(r);
    });
    clusterGroup.addLayer(marker);
  });
}

// Centra el mapa en una coordenada (al crear un reporte o elegir una coincidencia).
export function flyTo(lat, lng, zoom = 16) {
  map?.flyTo([lat, lng], zoom, { duration: 0.8 });
}

export function getMap() {
  return map;
}
