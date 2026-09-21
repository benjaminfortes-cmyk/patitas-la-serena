// Mapa Leaflet: inicialización, marcadores por tipo y agrupación de los que se pisan.

import { MAP_CENTER, MAP_ZOOM } from './config.js';
import { escapeHtml } from './ui.js';
import { KIND_META, ANIMAL_META, nombreAnimal, logoOrganizacion } from './constants.js';
import { agregarMapaBase } from './basemap.js';

let map;
let markersLayer;
let marcadoresPorId = new Map();   // id del reporte → su marcador en el mapa

// Dos pines se juntan en uno solo cuando cumplen LAS DOS cosas: que en la
// pantalla se estén tapando (pixeles) y que en el terreno estén casi en el
// mismo lugar (metros).
//
// El tope en metros es lo que evita que al alejarse se arme un amasijo: con el
// mapa bien atrás dos reportes de barrios distintos también se tapan, pero son
// dos lugares distintos y tienen que verse los dos. Solo se junta lo que de
// verdad está encima.
const SEPARACION_PX = 34;
const TOPE_METROS = 35;

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

// Pin de un grupo: el dibujo de siempre con una chapita que dice cuántos son.
// Si todos son del mismo tipo (y del mismo animal) conserva ese color y ese
// icono; si vienen mezclados va gris y con una huella, para no hacer creer que
// los cuatro son perdidos (o rescatados) cuando no lo son.
function crearIconoGrupo(reportes) {
  const unico = (campo) => reportes.every((r) => r[campo] === reportes[0][campo]);

  const color = unico('kind') ? (KIND_META[reportes[0].kind]?.color ?? '#888') : 'var(--muted)';
  const icono = unico('animal_type')
    ? (ANIMAL_META[reportes[0].animal_type]?.icon ?? 'ph-paw-print')
    : 'ph-paw-print';

  return L.divIcon({
    html: `
      <div class="pin" style="--pin: ${color}">
        <span class="pin__icon"><i class="ph-fill ${icono}"></i></span>
      </div>
      <span class="pin__contador">${reportes.length}</span>`,
    className: 'pin-wrapper',
    iconSize: [40, 48],
    iconAnchor: [20, 46],
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

  // Al acercarse o alejarse cambia qué pines se pisan, así que se reagrupan.
  map.on('zoomend', () => pintarMarcadores());

  return map;
}

let reportesActuales = [];
let alSeleccionar = null;

export function renderReports(reports, onSelect) {
  reportesActuales = reports.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  alSeleccionar = onSelect;
  pintarMarcadores({ forzar: true });
}

// Firma de la agrupación actual: si no cambió, no se vuelve a dibujar nada (si
// no, cada pellizco de zoom haría saltar todos los pines).
let firmaGrupos = '';

function pintarMarcadores({ forzar = false } = {}) {
  if (!map || !markersLayer) return;

  const grupos = agrupar(reportesActuales);
  const firma = grupos.map((g) => g.reportes.map((r) => r.id).join('+')).join('|');
  if (!forzar && firma === firmaGrupos) return;
  firmaGrupos = firma;

  markersLayer.clearLayers();
  marcadoresPorId = new Map();

  grupos.forEach((grupo) => {
    const marker = grupo.reportes.length === 1
      ? marcadorSuelto(grupo.reportes[0])
      : marcadorDeGrupo(grupo);
    markersLayer.addLayer(marker);
    grupo.reportes.forEach((r) => marcadoresPorId.set(r.id, marker));
  });

  pintarDestacado();   // si veníamos de la lista, el pin sigue marcado
}

function marcadorSuelto(r) {
  const marker = L.marker([r.lat, r.lng], {
    icon: crearIcono(r),
    keyboard: true,
    title: (r.pet_name || r.breed || 'Reporte') + (r.author_org ? ` · ${r.author_org}` : ''),
    riseOnHover: true,
  });
  marker.on('click', () => alSeleccionar?.(r));
  marker.on('keypress', (e) => {
    if (e.originalEvent.key === 'Enter') alSeleccionar?.(r);
  });
  return marker;
}

function marcadorDeGrupo(grupo) {
  const marker = L.marker(grupo.centro, {
    icon: crearIconoGrupo(grupo.reportes),
    keyboard: true,
    title: `${grupo.reportes.length} reportes en este punto`,
    riseOnHover: true,
  });
  const abrir = () => abrirGrupo(grupo, marker);
  marker.on('click', abrir);
  marker.on('keypress', (e) => {
    if (e.originalEvent.key === 'Enter') abrir();
  });
  return marker;
}

// Junta los reportes que caerían uno encima de otro al zoom actual. Se recorren
// una sola vez y se pregunta por las celdas vecinas, para no comparar todos
// contra todos cuando el mapa tenga muchos pines.
function agrupar(reportes) {
  const zoom = map.getZoom();
  const grupos = [];
  const rejilla = new Map();

  reportes.forEach((r) => {
    const centro = L.latLng(r.lat, r.lng);
    const punto = map.project(centro, zoom);

    // El pin al que se acaba de llegar va siempre solo: es el que se está
    // buscando y tiene que verse latiendo entre los demás.
    if (r.id === idDestacado) {
      grupos.push({ reportes: [r], centro, punto });
      return;
    }

    const cx = Math.floor(punto.x / SEPARACION_PX);
    const cy = Math.floor(punto.y / SEPARACION_PX);

    let vecino = null;
    for (let dx = -1; dx <= 1 && !vecino; dx += 1) {
      for (let dy = -1; dy <= 1 && !vecino; dy += 1) {
        for (const g of rejilla.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (punto.distanceTo(g.punto) <= SEPARACION_PX
              && centro.distanceTo(g.centro) <= TOPE_METROS) { vecino = g; break; }
        }
      }
    }

    if (vecino) { vecino.reportes.push(r); return; }

    const nuevo = { reportes: [r], centro, punto };
    grupos.push(nuevo);
    const clave = `${cx},${cy}`;
    if (!rejilla.has(clave)) rejilla.set(clave, []);
    rejilla.get(clave).push(nuevo);
  });

  return grupos;
}

// Tocar un grupo abre la lista para elegir cuál ver. No se acerca el mapa:
// como solo se juntan los que están a menos de TOPE_METROS, acercarse los
// dejaría igual de encimados y además perdería de vista el barrio. Acercando
// a mano sí se separan solos, porque dejan de taparse en pantalla.
function abrirGrupo(grupo, marker) {
  const caja = document.createElement('div');
  caja.className = 'grupo';
  caja.innerHTML = `
    <p class="grupo__tit">${grupo.reportes.length} reportes en este punto</p>
    <ul class="grupo__lista">
      ${grupo.reportes.map((r) => `
        <li>
          <button class="grupo__item" type="button" data-id="${escapeHtml(r.id)}">
            <img class="grupo__foto" src="${escapeHtml(r.photo_url ?? '')}" alt="" loading="lazy" />
            <span class="grupo__txt">
              <b>${escapeHtml(r.pet_name || nombreAnimal(r))}</b>
              <small style="color:${KIND_META[r.kind]?.color ?? 'inherit'}">${escapeHtml(KIND_META[r.kind]?.titular ?? '')}</small>
            </span>
            <i class="ph ph-caret-right" aria-hidden="true"></i>
          </button>
        </li>`).join('')}
    </ul>`;

  caja.addEventListener('click', (e) => {
    const btn = e.target.closest('.grupo__item');
    if (!btn) return;
    const r = grupo.reportes.find((x) => x.id === btn.dataset.id);
    map.closePopup();
    if (r) { destacar(r.id); alSeleccionar?.(r); }
  });

  L.popup({ className: 'grupo-popup', offset: [0, -42], maxWidth: 270, autoPanPadding: [20, 20] })
    .setLatLng(marker.getLatLng())
    .setContent(caja)
    .openOn(map);
}

// Ir al pin de un reporte: lo deja a la vista y lo hace latir un rato, para
// que se distinga entre los demás cuando hay varios juntos.
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

// Franja mínima donde un pin se ve entero y con algo de aire alrededor.
const FRANJA_MINIMA = 170;

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

  if (anchoFicha < ancho - 60) {          // escritorio: la ficha va al costado
    punto.x += (anchoFicha + 40) / 2;
    return map.unproject(punto, zoom);
  }

  // Teléfono: la ficha sube desde abajo y deja una franja arriba. Sólo vale la
  // pena correr el mapa si el pin cabe en esa franja SIN quedar debajo del
  // buscador; con la ficha alta no cabe, y forzarlo dejaba el pin pegado al
  // borde de arriba y tapado por los filtros. En ese caso se centra el reporte
  // en el mapa completo: al cerrar la ficha queda justo en el medio.
  const estorbo = altoControlesArriba();
  const franja = alto - altoFicha - estorbo;
  if (franja < FRANJA_MINIMA) return destino;

  punto.y += (alto / 2) - (estorbo + franja / 2);
  return map.unproject(punto, zoom);
}

// Lo que ocupan el buscador y los filtros sobre el mapa.
function altoControlesArriba() {
  const filtros = document.querySelector('.filters');
  if (!filtros) return 0;
  const caja = filtros.getBoundingClientRect();
  const mapa = map.getContainer().getBoundingClientRect();
  return Math.max(0, caja.bottom - mapa.top) + 12;
}

const DESTACADO_MS = 6000;
let idDestacado = null;
let quitarDestacado;

function destacar(id) {
  clearTimeout(quitarDestacado);
  idDestacado = id;
  pintarMarcadores();   // el destacado se sale de su grupo para poder verse
  pintarDestacado();
  quitarDestacado = setTimeout(() => {
    idDestacado = null;
    pintarMarcadores();
    pintarDestacado();
  }, DESTACADO_MS);
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
