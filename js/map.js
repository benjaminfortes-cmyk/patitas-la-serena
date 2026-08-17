// Mapa Leaflet: inicialización, marcadores por tipo y clustering.

import { MAP_CENTER, MAP_ZOOM } from './config.js';
import { escapeHtml } from './ui.js';
import { KIND_META, ANIMAL_META, logoOrganizacion } from './constants.js';

let map;
let markersLayer;

function crearIcono(report) {
  const color = KIND_META[report.kind]?.color ?? '#888';
  const icono = ANIMAL_META[report.animal_type]?.icon ?? 'ph-paw-print';
  const resuelto = report.lifecycle === 'resuelto';
  const org = report.author_org;
  const logo = logoOrganizacion(org);

  const sello = !org ? '' : logo
    ? `<span class="pin__sello"><img src="${logo}" alt="${escapeHtml(org)}" /></span>`
    : '<span class="pin__sello pin__sello--icono"><i class="ph-fill ph-seal-check"></i></span>';

  const html = `
    <div class="pin ${resuelto ? 'pin--resuelto' : ''}" style="--pin: ${color}">
      <span class="pin__icon"><i class="ph-fill ${resuelto ? 'ph-heart' : icono}"></i></span>
    </div>
    ${sello}`;

  return L.divIcon({
    html,
    className: 'pin-wrapper',
    iconSize: [40, 48],
    iconAnchor: [20, 46],   // punta del pin
    popupAnchor: [0, -44],
  });
}

export function initMap() {
  map = L.map('map', { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Los créditos se van a la esquina contraria: en la de abajo a la derecha
  // quedaban encima de los botones de zoom. Hay que mostrarlos igual, es la
  // licencia de OpenStreetMap.
  map.attributionControl.setPosition('bottomleft');

  // CARTO y no openstreetmap.org: su servidor público no permite apps con
  // tráfico y puede bloquearlas.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  }).addTo(map);

  markersLayer = L.layerGroup();
  map.addLayer(markersLayer);

  return map;
}

export function renderReports(reports, onSelect) {
  markersLayer.clearLayers();

  reports.forEach((r) => {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
    const marker = L.marker([r.lat, r.lng], {
      icon: crearIcono(r),
      keyboard: true,
      title: (r.pet_name || r.breed || 'Reporte') + (r.author_org ? ` · ${r.author_org}` : ''),
      riseOnHover: true,
    });
    marker.on('click', () => onSelect?.(r));
    marker.on('keypress', (e) => {
      if (e.originalEvent.key === 'Enter') onSelect?.(r);
    });
    markersLayer.addLayer(marker);
  });
}

export function flyTo(lat, lng, zoom = 16) {
  if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  map.invalidateSize();
  const { x, y } = map.getSize();
  if (x === 0 || y === 0) {
    map.setView([lat, lng], zoom, { animate: false });
    return;
  }

  map.flyTo([lat, lng], zoom, { duration: 0.8 });
}

export function getMap() {
  return map;
}
