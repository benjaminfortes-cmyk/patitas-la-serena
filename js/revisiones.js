// ============================================================================
// Avisos por verificar — SOLO ADMINISTRADORES
//
// Lista de los reportes con resolution_review = true (ver migración 0010), con
// el WhatsApp de la familia a mano para confirmar.
//   Confirmar -> deja de estar en revisión.
//   Rechazar  -> vuelve al mapa como activo, con la caducidad reiniciada.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { fetchAvisosPendientes, fetchContacto } from './data.js';
import { isAdminUser, onAuthChange } from './auth.js';
import { DEMO_REPORTS } from './demo.js';
import { tituloReporte, nombreAnimal, tiempoRelativo } from './constants.js';
import { openReportCard } from './reportCard.js';
import { escapeHtml, toast } from './ui.js';

let btn = null;

export function initRevisiones() {
  onAuthChange(() => {
    if (!isAdminUser()) { btn?.remove(); btn = null; return; }
    if (btn) return;

    btn = document.createElement('button');
    btn.id = 'btn-revisiones';
    btn.className = 'btn btn--ghost btn--sm';
    btn.title = 'Avisos de reencuentro por verificar';
    btn.addEventListener('click', abrir);
    document.querySelector('.topbar__actions')?.appendChild(btn);
    pintarBoton(0);
    actualizarContador();
  });
}

function pintarBoton(n) {
  if (!btn) return;
  btn.innerHTML =
    '<i class="ph ph-clock-user" aria-hidden="true"></i>' +
    '<span class="hide-mobile">Avisos</span>' +
    (n > 0 ? `<span class="btn__badge">${n}</span>` : '');
}

// Se recalcula al entrar como admin y al cerrar el panel.
async function actualizarContador() {
  if (!btn) return;
  const pendientes = await fetchAvisosPendientes();
  pintarBoton(pendientes.length);
}

async function abrir() {
  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Avisos por verificar">
      <div class="matches__head">
        <h3>Avisos por verificar</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">
        Alguien de la comunidad avisó que estas mascotas volvieron a casa.
        Habla con la familia y confirma o devuelve el reporte al mapa.
      </p>
      <div class="revisiones" aria-live="polite"><p class="matches__sub">Cargando…</p></div>
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => { overlay.remove(); actualizarContador(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  const lista = overlay.querySelector('.revisiones');
  const pendientes = await fetchAvisosPendientes();
  pintarBoton(pendientes.length);

  if (!pendientes.length) {
    lista.innerHTML = `
      <div class="historias__empty">
        <div class="empty__art"><i class="ph ph-check-circle"></i></div>
        <p>No hay avisos pendientes.</p>
      </div>`;
    return;
  }

  lista.innerHTML = pendientes.map((r) => `
    <div class="revision" data-id="${escapeHtml(r.id)}">
      <img class="revision__img" src="${escapeHtml(r.photo_url)}"
           alt="Foto de ${escapeHtml(tituloReporte(r))}" loading="lazy" />
      <div class="revision__info">
        <strong>${escapeHtml(r.pet_name || nombreAnimal(r))}</strong>
        <small>Avisado ${r.resolved_at ? tiempoRelativo(r.resolved_at) : 'hace poco'}</small>
        <div class="revision__btns">
          <a class="btn btn--whatsapp btn--sm is-cargando" data-wa target="_blank" rel="noopener" href="#">
            <i class="ph ph-whatsapp-logo"></i> Escribir
          </a>
          <button class="btn btn--soft btn--sm" data-ok><i class="ph ph-check"></i> Confirmar</button>
          <button class="btn btn--outline btn--sm" data-no><i class="ph ph-x"></i> Sigue perdido</button>
          <button class="btn btn--ghost btn--sm" data-ver><i class="ph ph-eye"></i> Ver ficha</button>
        </div>
      </div>
    </div>`).join('');

  // Los teléfonos se piden de a uno, igual que en la ficha.
  pendientes.forEach(async (r) => {
    const fila = lista.querySelector(`.revision[data-id="${CSS.escape(r.id)}"]`);
    const wa = fila?.querySelector('[data-wa]');
    if (!wa) return;
    const numero = String(await fetchContacto(r) ?? '').replace(/[^0-9]/g, '');
    if (!lista.contains(wa)) return;
    if (!numero) { wa.textContent = 'Sin contacto'; return; }
    wa.href = `https://wa.me/${numero}?text=` + encodeURIComponent(
      `Hola, soy de Busca Huellitas. Nos avisaron que ${tituloReporte(r)} ya volvió a casa. ¿Nos confirmas?`
    );
    wa.classList.remove('is-cargando');
  });

  lista.addEventListener('click', async (e) => {
    const fila = e.target.closest('.revision');
    if (!fila) return;
    const r = pendientes.find((x) => x.id === fila.dataset.id);
    if (!r) return;

    if (e.target.closest('[data-ver]')) { cerrar(); return openReportCard(r); }

    const ok = e.target.closest('[data-ok]');
    const no = e.target.closest('[data-no]');
    if (!ok && !no) return;
    if (no && !confirm('¿La mascota sigue perdida? El reporte volverá al mapa como activo.')) return;

    if (await moderar(r, Boolean(ok))) {
      fila.remove();
      pintarBoton(lista.querySelectorAll('.revision').length);
      window.recargarMapa?.();
      if (!lista.querySelector('.revision')) cerrar();
    }
  });
}

async function moderar(report, confirmado) {
  const rpc = confirmado ? 'confirm_resolution' : 'reject_resolution';
  if (isConfigured) {
    const { error } = await supabase.rpc(rpc, { p_report_id: report.id });
    if (error) { toast(error.message, 'error'); return false; }
  } else {
    const r = DEMO_REPORTS.find((x) => x.id === report.id);
    if (r) {
      r.resolution_review = false;
      if (!confirmado) { r.lifecycle = 'activo'; r.resolved_at = null; }
    }
  }
  toast(confirmado ? 'Reencuentro confirmado.' : 'Listo, el reporte vuelve a estar activo.', 'exito');
  return true;
}
