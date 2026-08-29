// Mapa Leaflet: inicialización, marcadores por tipo y clustering.

import { MAP_CENTER, MAP_ZOOM } from './config.js';
import { escapeHtml } from './ui.js';
import { KIND_META, ANIMAL_META, logoOrganizacion } from './constants.js';
import { agregarMapaBase } from './basemap.js';

let map;
let markersLayer;
let marcadoresPorId = new Map();   // id del reporte → su marcador en el mapa

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

  agregarMapaBase(map);

  markersLayer = L.layerGroup();
  map.addLayer(markersLayer);

  return map;
}

export function renderReports(reports, onSelect) {
  markersLayer.clearLayers();
  marcadoresPorId = new Map();

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
    marcadoresPorId.set(r.id, marker);
  });

  pintarDestacado();   // si veníamos de la lista, el pin sigue marcado
}

// Ir al pin de un reporte: lo deja a la vista y lo hace latir un rato, para
// que se distinga entre los demás cuando hay varios pines juntos.
export function irAlPin(report) {
  if (!map || !Number.isFinite(report?.lat) || !Number.isFinite(report?.lng)) return;

  destacar(report.id);

  map.invalidateSize();
  const destino = L.latLng(report.lat, report.lng);
  const zoom = Math.max(map.getZoom(), 16);
  const { x, y } = map.getSize();

  if (x === 0 || y === 0) {           // el mapa todavía no se ha mostrado
    map.setView(destino, zoom, { animate: false });
    return;
  }
  map.flyTo(centroVisible(destino, zoom), zoom, { duration: 0.8 });
}

// La ficha tapa parte del mapa: en escritorio una franja a la derecha y en el
// teléfono casi toda la pantalla. Corremos el centro para que el pin caiga en
// el pedazo que sí se ve; si no, el mapa "va" al reporte pero queda escondido.
function centroVisible(destino, zoom) {
  const ficha = document.getElementById('detail');
  if (!ficha?.classList.contains('sheet--open')) return destino;

  // offsetWidth/Height y no getBoundingClientRect: la ficha entra deslizándose
  // y el rect devolvería su posición a media animación.
  const anchoFicha = ficha.offsetWidth;
  const altoFicha = ficha.offsetHeight;
  const { x: ancho, y: alto } = map.getSize();
  const punto = map.project(destino, zoom);

  if (anchoFicha < ancho - 60) punto.x += (anchoFicha + 40) / 2;   // está al costado
  else                         punto.y += altoFicha / 2;           // tapa desde abajo

  return map.unproject(punto, zoom);
}

const DESTACADO_MS = 6000;
let idDestacado = null;
let quitarDestacado;

function destacar(id) {
  clearTimeout(quitarDestacado);
  idDestacado = id;
  pintarDestacado();
  quitarDestacado = setTimeout(() => { idDestacado = null; pintarDestacado(); }, DESTACADO_MS);
}

function pintarDestacado() {
  marcadoresPorId.forEach((marcador, id) => {
    marcador.getElement()?.classList.toggle('pin-wrapper--destacado', id === idDestacado);
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
