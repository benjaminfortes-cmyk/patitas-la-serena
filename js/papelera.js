// Papelera: los reportes ocultos del mapa, para revisarlos y volver a publicar.
//
// Antes el botón "Borrar" hacía un delete de verdad: la fila se iba de la base
// y no quedaba forma de recuperarla (la foto sí se quedaba en el bucket, por
// eso se pudo saber después cuántos reportes se habían perdido). Ahora nada se
// borra: "Ocultar del mapa" los manda acá, quedan guardados enteros y desde
// esta lista se deciden uno por uno.

import { supabase, isConfigured } from './supabase.js';
import { fetchArchivados } from './data.js';
import { isStaffUser, onAuthChange } from './auth.js';
import { DEMO_REPORTS } from './demo.js';
import { tituloReporte, nombreAnimal, tiempoRelativo, KIND_META } from './constants.js';
import { openReportCard } from './reportCard.js';
import { escapeHtml, toast } from './ui.js';

let btn = null;

export function initPapelera() {
  onAuthChange(() => {
    if (!isStaffUser()) { btn?.remove(); btn = null; return; }
    if (btn) return;

    btn = document.createElement('button');
    btn.id = 'btn-papelera';
    btn.className = 'btn btn--ghost btn--sm';
    btn.title = 'Reportes ocultos del mapa';
    btn.innerHTML = '<i class="ph ph-archive-box" aria-hidden="true"></i><span class="hide-mobile">Papelera</span>';
    btn.addEventListener('click', abrir);
    document.querySelector('.topbar__actions')?.appendChild(btn);
  });
}

async function abrir() {
  if (document.querySelector('.papelera-overlay')) return;   // ya está abierta

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay papelera-overlay';
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Papelera">
      <div class="matches__head">
        <h3>Papelera</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">
        Reportes ocultos del mapa. No se borra ninguno: quedan guardados acá hasta
        que decidas si los vuelves a publicar.
      </p>
      <div class="revisiones" aria-live="polite"><p class="matches__sub">Cargando…</p></div>
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  const lista = overlay.querySelector('.revisiones');
  const ocultos = await fetchArchivados();

  if (!ocultos.length) {
    lista.innerHTML = `
      <div class="historias__empty">
        <div class="empty__art"><i class="ph ph-archive-box"></i></div>
        <p>No hay nada oculto. Todo lo publicado está en el mapa.</p>
      </div>`;
    return;
  }

  lista.innerHTML = ocultos.map((r) => `
    <div class="revision" data-id="${escapeHtml(r.id)}">
      <img class="revision__img" src="${escapeHtml(r.photo_url ?? '')}"
           alt="Foto de ${escapeHtml(tituloReporte(r))}" loading="lazy" />
      <div class="revision__info">
        <strong>${escapeHtml(r.pet_name || nombreAnimal(r))}</strong>
        <small>${escapeHtml(KIND_META[r.kind]?.titular ?? '')} · publicado ${tiempoRelativo(r.created_at ?? r.event_at)}</small>
        <div class="revision__btns">
          <button class="btn btn--soft btn--sm" data-volver>
            <i class="ph ph-arrow-counter-clockwise"></i> Volver a publicar
          </button>
          <button class="btn btn--ghost btn--sm" data-ver><i class="ph ph-eye"></i> Ver ficha</button>
        </div>
      </div>
    </div>`).join('');

  lista.addEventListener('click', async (e) => {
    const fila = e.target.closest('.revision');
    if (!fila) return;
    const r = ocultos.find((x) => x.id === fila.dataset.id);
    if (!r) return;

    if (e.target.closest('[data-ver]')) { cerrar(); return openReportCard(r); }
    if (!e.target.closest('[data-volver]')) return;

    if (await republicar(r)) {
      fila.remove();
      window.recargarMapa?.();
      if (!lista.querySelector('.revision')) cerrar();
    }
  });
}

async function republicar(report) {
  if (!isConfigured) {
    const r = DEMO_REPORTS.find((x) => x.id === report.id);
    if (r) r.lifecycle = 'activo';
    toast('Vuelve a estar en el mapa.', 'exito');
    return true;
  }

  // reactivate_report() lo devuelve a 'activo' y le reinicia la caducidad, así
  // no se vuelve a ocultar solo a los pocos días de haberlo rescatado.
  const { error } = await supabase.rpc('reactivate_report', { p_report_id: report.id });
  if (error) { toast(error.message, 'error'); return false; }

  toast('Vuelve a estar en el mapa.', 'exito');
  return true;
}
