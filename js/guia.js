// Botón "Información": reportes recientes y leyenda de los pines.

import { KIND_META, nombreAnimal, tiempoRelativo, fechaPublicacion } from './constants.js';
import { escapeHtml } from './ui.js';
import { fetchReports } from './data.js';
import { openReportCard } from './reportCard.js';
import { flyTo } from './map.js';

const LEYENDA = [
  {
    clase: '', color: KIND_META.perdido.color, icono: 'ph-dog',
    titulo: KIND_META.perdido.label,
    texto: 'Su familia lo está buscando. Si lo viste, escríbeles por WhatsApp.',
  },
  {
    clase: '', color: KIND_META.encontrado.color, icono: 'ph-house-line',
    titulo: KIND_META.encontrado.label,
    texto: 'Alguien lo rescató y lo tiene a salvo, pero su familia todavía no aparece.',
  },
  {
    clase: '', color: KIND_META.avistado.color, icono: 'ph-eye',
    titulo: KIND_META.avistado.label,
    texto: 'Lo vieron suelto en la calle, pero no alcanzaron a acercarse a él.',
  },
  {
    clase: 'pin--resuelto', color: '', icono: 'ph-heart',
    titulo: 'Reunidos con familia',
    texto: 'Volvió a casa. Queda 7 días en el mapa como final feliz y luego se archiva.',
  },
];

export function initGuia() {
  window.openGuia = abrir;
}

async function abrir() {
  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';

  const filas = LEYENDA.map((l) => `
    <li class="leyenda__item">
      <span class="pin ${l.clase}" ${l.color ? `style="--pin:${l.color}"` : ''} aria-hidden="true">
        <span class="pin__icon"><i class="ph-fill ${l.icono}"></i></span>
      </span>
      <span class="leyenda__txt">
        <b>${l.titulo}</b>
        <small>${l.texto}</small>
      </span>
    </li>`).join('');

  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Reportes y guía del mapa">
      <div class="matches__head">
        <h3>Reportes recientes</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Toca cualquiera para verlo en el mapa.</p>

      <div class="listado" id="guia-listado">
        <p class="listado__cargando">Cargando reportes…</p>
      </div>

      <div class="leyenda-bloque">
        <h4 class="leyenda-bloque__titulo">¿Qué significa cada color?</h4>
        <ul class="leyenda">${filas}</ul>
        <p class="leyenda__pie">
          <i class="ph ph-paw-print" aria-hidden="true"></i>
          El dibujo dentro del pin indica si es un perro, un gato u otro animal.
        </p>
        <p class="leyenda__pie">
          <i class="ph-fill ph-seal-check" aria-hidden="true"></i>
          El logo pegado al pin indica que ese aviso lo publicó una organización
          aliada que rescata en terreno.
        </p>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  cargarListado(overlay, cerrar);
}

async function cargarListado(overlay, cerrar) {
  const cont = overlay.querySelector('#guia-listado');
  let reportes = [];
  try {
    reportes = await fetchReports({});
  } catch {
    cont.innerHTML = '<p class="listado__cargando">No se pudieron cargar los reportes.</p>';
    return;
  }

  reportes.sort((a, b) => new Date(b.created_at ?? b.event_at) - new Date(a.created_at ?? a.event_at));

  if (!reportes.length) {
    cont.innerHTML = '<p class="listado__cargando">Todavía no hay reportes en el mapa.</p>';
    return;
  }

  cont.innerHTML = reportes.map((r) => {
    const k = KIND_META[r.kind] ?? {};
    const resuelto = r.lifecycle === 'resuelto';
    const titulo = r.pet_name ? escapeHtml(r.pet_name) : escapeHtml(nombreAnimal(r));
    const etiqueta = resuelto ? 'Reunidos con familia' : (k.titular ?? '');
    const color = resuelto ? 'var(--reunidos)' : (k.color ?? '#888');
    return `
      <button class="listado__item" type="button" data-id="${r.id}">
        <img class="listado__foto" src="${escapeHtml(r.photo_url)}" alt="" loading="lazy" />
        <span class="listado__info">
          <span class="listado__linea">
            <span class="listado__punto" style="background:${color}"></span>
            <b class="listado__titulo">${titulo}</b>
          </span>
          <span class="listado__estado">${etiqueta}</span>
          <span class="listado__fecha">${r.created_at ? fechaPublicacion(r.created_at) : tiempoRelativo(r.event_at)}</span>
        </span>
        <i class="ph ph-caret-right listado__flecha" aria-hidden="true"></i>
      </button>`;
  }).join('');

  cont.querySelectorAll('.listado__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = reportes.find((x) => x.id === btn.dataset.id);
      if (!r) return;
      cerrar();
      window.mostrarVista?.('mapa');
      openReportCard(r);
      if (r.lat != null) flyTo(r.lat, r.lng, 16);
    });
  });
}
