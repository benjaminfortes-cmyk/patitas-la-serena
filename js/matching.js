// ============================================================================
// Matching inteligente.
//
// Al publicar un reporte, busca candidatos del tipo OPUESTO, mismo animal,
// dentro de 3 km y publicados en los últimos 30 días, y los muestra en un
// panel con miniaturas clickeables.
//   - perdido            -> busca encontrado / avistado
//   - encontrado/avistado -> busca perdido
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { DEMO_REPORTS } from './demo.js';
import { fetchReportById } from './data.js';
import { openReportCard } from './reportCard.js';
import { flyTo } from './map.js';
import { tituloReporte, nombreAnimal } from './constants.js';
import { escapeHtml } from './ui.js';

const RADIO_M = 3000;
const DIAS = 30;

export function initMatching() {
  window.buscarCoincidencias = buscarCoincidencias;
}

// Distancia Haversine en metros (para el modo demo).
function distancia(aLat, aLng, bLat, bLng) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function buscarCoincidencias(report) {
  let matches = [];

  if (!isConfigured) {
    // Demo: cruce local contra los datos de prueba.
    const corte = Date.now() - DIAS * 86400000;
    matches = DEMO_REPORTS
      .filter((r) =>
        r.id !== report.id &&
        r.lifecycle === 'activo' &&
        r.animal_type === report.animal_type &&
        new Date(r.created_at).getTime() > corte &&
        (report.kind === 'perdido' ? r.kind !== 'perdido' : r.kind === 'perdido'))
      .map((r) => ({ ...r, distance_m: distancia(report.lat, report.lng, r.lat, r.lng) }))
      .filter((r) => r.distance_m <= RADIO_M)
      .sort((a, b) => a.distance_m - b.distance_m);
  } else {
    // Real: usa la función find_matches() (PostGIS) del backend.
    const { data, error } = await supabase.rpc('find_matches', { p_report_id: report.id });
    if (error) { console.error(error.message); return; }
    matches = data ?? [];
  }

  if (matches.length) renderPanel(matches, report.kind);
}

// Texto de distancia amigable.
function distanciaTxt(m) {
  return m < 1000 ? `a ~${Math.round(m / 10) * 10} m` : `a ~${(m / 1000).toFixed(1)} km`;
}

function renderPanel(matches, kindOrigen) {
  document.getElementById('matches-overlay')?.remove();

  const titulo = kindOrigen === 'perdido'
    ? `Encontramos ${matches.length} posible${matches.length > 1 ? 's' : ''} coincidencia${matches.length > 1 ? 's' : ''} cerca`
    : `Hay ${matches.length} mascota${matches.length > 1 ? 's' : ''} perdida${matches.length > 1 ? 's' : ''} cerca que podrían calzar`;

  const overlay = document.createElement('div');
  overlay.id = 'matches-overlay';
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Posibles coincidencias">
      <div class="matches__head">
        <h3>${escapeHtml(titulo)} 🐾</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Mismo tipo de animal, a menos de 3 km. Toca una para revisarla.</p>
      <div class="matches__grid">
        ${matches.map((m) => `
          <button class="match" data-id="${escapeHtml(m.id)}">
            <img src="${escapeHtml(m.photo_url)}" alt="Foto de ${escapeHtml(tituloReporte(m))}" loading="lazy" />
            <span class="match__title">${escapeHtml(m.pet_name || nombreAnimal(m))}</span>
            <small class="match__dist">${distanciaTxt(m.distance_m)}</small>
          </button>`).join('')}
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  overlay.querySelectorAll('.match').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = await fetchReportById(btn.dataset.id);
      cerrar();
      if (r) { openReportCard(r); if (r.lat != null) flyTo(r.lat, r.lng, 16); }
    });
  });
}
