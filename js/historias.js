// ============================================================================
// "Historias felices": muestra los últimos reencuentros como prueba social
// de que la plataforma funciona. Se abre desde el botón del encabezado.
// ============================================================================
import { fetchHappyStories } from './data.js';
import { openReportCard } from './reportCard.js';
import { tituloReporte, nombreAnimal, tiempoRelativo } from './constants.js';
import { escapeHtml } from './ui.js';

export function initHistorias() {
  document.getElementById('btn-historias')?.addEventListener('click', abrir);
}

async function abrir() {
  const historias = await fetchHappyStories(20);

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';

  const contenido = historias.length
    ? `<div class="historias__grid">
        ${historias.map((r) => `
          <button class="historia" data-id="${escapeHtml(r.id)}">
            <div class="historia__img">
              <img src="${escapeHtml(r.photo_url)}" alt="Foto de ${escapeHtml(tituloReporte(r))}" loading="lazy" />
              <span class="badge badge--reunidos"><i class="ph-fill ph-heart"></i> Reunidos</span>
            </div>
            <span class="historia__title">${escapeHtml(r.pet_name || nombreAnimal(r))}</span>
            <small class="historia__when">${r.resolved_at ? 'Reunidos ' + tiempoRelativo(r.resolved_at) : ''}</small>
          </button>`).join('')}
       </div>`
    : `<div class="historias__empty">
        <div class="empty__art"><i class="ph ph-paw-print"></i></div>
        <p>Aún no hay reencuentros registrados.<br>¡Ojalá el primero sea pronto!</p>
       </div>`;

  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Historias felices">
      <div class="matches__head">
        <h3>Historias felices</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Mascotas que volvieron a casa gracias a la comunidad.</p>
      ${contenido}
    </div>`;

  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  overlay.querySelectorAll('.historia').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = historias.find((x) => x.id === btn.dataset.id);
      cerrar();
      if (r) openReportCard(r);
    });
  });
}
