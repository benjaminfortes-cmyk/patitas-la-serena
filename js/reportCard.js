// ============================================================================
// Ficha del reporte (bottom-sheet que se abre al tocar un marcador).
//
// Incluye: foto + datos, contacto por WhatsApp, Compartir (Web Share API con
// fallback a copiar), denuncia de info incorrecta/duplicada, y —si es del
// usuario logueado— botones "Marcar como resuelto ❤️" y "Editar".
// ============================================================================
import { KIND_META, nombreAnimal, tiempoRelativo, tituloReporte } from './constants.js';
import { escapeHtml, toast } from './ui.js';
import { getUser, ensureSession, isAdminUser } from './auth.js';
import { supabase, isConfigured } from './supabase.js';
import { DEMO_REPORTS } from './demo.js';

const SIZE_LABEL = { chico: 'Chico', mediano: 'Mediano', grande: 'Grande' };

// Link de WhatsApp con mensaje pre-redactado.
function whatsappLink(report) {
  const num = report.contact_whatsapp.replace(/[^0-9]/g, ''); // 569XXXXXXXX
  const msg = `Hola, vi tu publicación en Busca Huellitas sobre ${tituloReporte(report)}. ¿Sigue activa la búsqueda?`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export function openReportCard(report) {
  const sheet = document.getElementById('detail');
  const k = KIND_META[report.kind];
  const resuelto = report.lifecycle === 'resuelto';
  const user = getUser();
  const esDueno = user && report.user_id && report.user_id === user.id;
  // El administrador puede gestionar cualquier reporte (la base de datos
  // también lo permite vía RLS; aquí solo mostramos los botones).
  const puedeGestionar = esDueno || (user && isAdminUser());

  const fila = (label, val) =>
    val ? `<div class="detail__row"><dt>${label}</dt><dd>${escapeHtml(val)}</dd></div>` : '';

  // Botones de gestión (resolver / editar / sigue activo): dueño o admin, si no está resuelto.
  const accionesDueno = (puedeGestionar && !resuelto) ? `
    ${!esDueno ? '<p class="detail__adminnote"><i class="ph ph-shield-check"></i> Estás editando como administrador</p>' : ''}
    <div class="detail__owner">
      <button class="btn btn--soft" data-action="resolver"><i class="ph ph-heart"></i> Marcar como resuelto</button>
      <button class="btn btn--outline" data-action="editar"><i class="ph ph-pencil-simple"></i> Editar</button>
    </div>
    <button class="btn btn--ghost detail__keepalive" data-action="reactivar">
      <i class="ph ph-arrow-clockwise"></i> Sigue activo (reiniciar caducidad)
    </button>` : '';

  // Zona de administrador: archivar (ocultar) o borrar CUALQUIER reporte.
  // La base de datos ya lo permite vía RLS (is_admin); aquí solo van los botones.
  const esAdmin = user && isAdminUser();
  const archivado = report.lifecycle === 'archivado';
  const accionesAdmin = esAdmin ? `
    <div class="detail__admin">
      <p class="detail__adminnote"><i class="ph ph-shield-star"></i> Zona de administrador</p>
      <div class="detail__adminbtns">
        ${archivado
          ? '<span class="detail__archivedtag"><i class="ph ph-eye-slash"></i> Archivado (oculto del mapa)</span>'
          : '<button class="btn btn--outline" data-action="archivar"><i class="ph ph-archive-box"></i> Archivar (ocultar)</button>'}
        <button class="btn btn--danger" data-action="borrar"><i class="ph ph-trash"></i> Borrar</button>
      </div>
    </div>` : '';

  sheet.innerHTML = `
    <button class="sheet__close" aria-label="Cerrar" data-close>&times;</button>
    <div class="detail__photo">
      <img src="${escapeHtml(report.photo_url)}"
           alt="Foto de ${escapeHtml(tituloReporte(report))}" loading="lazy" />
      <span class="badge" style="--badge:${k.color}">${k.label}</span>
      ${resuelto ? '<span class="badge badge--reunidos"><i class="ph-fill ph-heart"></i> Reunidos</span>' : ''}
    </div>

    <div class="detail__body">
      <h2 class="detail__title">${report.pet_name ? escapeHtml(report.pet_name) : nombreAnimal(report)}</h2>
      <p class="detail__meta">${nombreAnimal(report)} · ${tiempoRelativo(report.event_at)}</p>

      <dl class="detail__list">
        ${fila('Raza', report.breed)}
        ${fila('Color / señas', report.color)}
        ${fila('Tamaño', SIZE_LABEL[report.size])}
        ${fila('Descripción', report.description)}
      </dl>

      <a class="btn btn--whatsapp" href="${whatsappLink(report)}" target="_blank" rel="noopener">
        <i class="ph ph-whatsapp-logo"></i> Contactar por WhatsApp
      </a>

      <div class="detail__actions">
        <button class="btn btn--soft" data-action="compartir"><i class="ph ph-share-network"></i> Compartir</button>
        <button class="btn btn--soft" data-action="denunciar"><i class="ph ph-flag"></i> Info incorrecta</button>
      </div>

      ${accionesDueno}
      ${accionesAdmin}
    </div>`;

  // Cableado de botones
  sheet.querySelector('[data-close]').addEventListener('click', closeReportCard);
  sheet.querySelector('[data-action="compartir"]').addEventListener('click', () => compartir(report));
  sheet.querySelector('[data-action="denunciar"]').addEventListener('click', () => abrirDenuncia(report));
  sheet.querySelector('[data-action="resolver"]')?.addEventListener('click', () => resolver(report));
  sheet.querySelector('[data-action="reactivar"]')?.addEventListener('click', () => reactivar(report));
  sheet.querySelector('[data-action="editar"]')?.addEventListener('click', () => {
    closeReportCard();
    window.openReportForm?.(report);
  });
  sheet.querySelector('[data-action="archivar"]')?.addEventListener('click', () => archivar(report));
  sheet.querySelector('[data-action="borrar"]')?.addEventListener('click', () => borrar(report));

  sheet.classList.add('sheet--open');
  document.getElementById('backdrop').classList.add('backdrop--show');
}

export function closeReportCard() {
  document.getElementById('detail')?.classList.remove('sheet--open');
  document.getElementById('backdrop')?.classList.remove('backdrop--show');
}

// ---- Compartir ------------------------------------------------------------
async function compartir(report) {
  const url = `${location.origin}${location.pathname}?reporte=${report.id}`;
  const datos = {
    title: 'Busca Huellitas',
    text: `Ayuda con ${tituloReporte(report)} en Busca Huellitas`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(datos); } catch { /* el usuario canceló */ }
  } else {
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado.', 'exito'); }
    catch { toast(url, 'info'); }
  }
}

// ---- Marcar como resuelto -------------------------------------------------
async function resolver(report) {
  if (!confirm('¿Marcar como resuelto? Quedará visible 7 días como "Reunidos" y luego se archiva.')) return;

  if (isConfigured) {
    const { error } = await supabase.rpc('mark_resolved', { p_report_id: report.id });
    if (error) return toast(error.message, 'error');
  } else {
    const r = DEMO_REPORTS.find((x) => x.id === report.id);
    if (r) { r.lifecycle = 'resuelto'; r.resolved_at = new Date().toISOString(); }
  }
  toast('¡Reunidos! Gracias por avisar.', 'exito');
  closeReportCard();
  window.recargarMapa?.();
}

// ---- Sigue activo (reinicia el contador de caducidad de 45 días) ----------
async function reactivar(report) {
  if (isConfigured) {
    const { error } = await supabase.rpc('reactivate_report', { p_report_id: report.id });
    if (error) return toast(error.message, 'error');
  } else {
    const r = DEMO_REPORTS.find((x) => x.id === report.id);
    if (r) r.last_active_at = new Date().toISOString();
  }
  toast('Listo, el reporte sigue activo.', 'exito');
}

// ---- Admin: archivar (ocultar del mapa, reversible con "Sigue activo") ----
async function archivar(report) {
  if (!confirm('¿Archivar este reporte? Se ocultará del mapa. Podrás volver a mostrarlo con "Sigue activo".')) return;

  if (isConfigured) {
    const { error } = await supabase.from('reports')
      .update({ lifecycle: 'archivado', updated_at: new Date().toISOString() })
      .eq('id', report.id);
    if (error) return toast(error.message, 'error');
  } else {
    const r = DEMO_REPORTS.find((x) => x.id === report.id);
    if (r) r.lifecycle = 'archivado';
  }
  toast('Reporte archivado (oculto del mapa).', 'exito');
  closeReportCard();
  window.recargarMapa?.();
}

// ---- Admin: borrar definitivamente (no se puede deshacer) -----------------
async function borrar(report) {
  if (!confirm('¿Borrar este reporte para SIEMPRE? Esta acción no se puede deshacer.')) return;

  if (isConfigured) {
    const { error } = await supabase.from('reports').delete().eq('id', report.id);
    if (error) return toast(error.message, 'error');
  } else {
    const i = DEMO_REPORTS.findIndex((x) => x.id === report.id);
    if (i >= 0) DEMO_REPORTS.splice(i, 1);
  }
  toast('Reporte borrado.', 'exito');
  closeReportCard();
  window.recargarMapa?.();
}

// ---- Denuncia (info incorrecta / duplicada) -------------------------------
async function abrirDenuncia(report) {
  await ensureSession();

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Reportar información">
      <div class="matches__head">
        <h3>¿Qué pasa con este reporte?</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <div class="flag__reasons">
        <button class="seg__btn" data-reason="incorrecta">Info incorrecta</button>
        <button class="seg__btn" data-reason="duplicada">Está duplicado</button>
        <button class="seg__btn" data-reason="spam">Es spam</button>
        <button class="seg__btn" data-reason="otro">Otro</button>
      </div>
      <textarea class="input" id="flag-note" rows="2" placeholder="Cuéntanos brevemente (opcional)…"></textarea>
      <button class="btn btn--primary" id="flag-send" disabled><i class="ph ph-paper-plane-tilt"></i> Enviar</button>
    </div>`;
  document.body.appendChild(overlay);

  let motivo = null;
  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  overlay.querySelectorAll('[data-reason]').forEach((b) => {
    b.addEventListener('click', () => {
      overlay.querySelectorAll('[data-reason]').forEach((x) => x.classList.remove('seg__btn--active'));
      b.classList.add('seg__btn--active');
      motivo = b.dataset.reason;
      overlay.querySelector('#flag-send').disabled = false;
    });
  });

  overlay.querySelector('#flag-send').addEventListener('click', async () => {
    const note = overlay.querySelector('#flag-note').value.trim() || null;
    if (isConfigured) {
      const { error } = await supabase.rpc('flag_report', {
        p_report_id: report.id, p_reason: motivo, p_note: note,
      });
      if (error) return toast(error.message, 'error');
    }
    cerrar();
    toast('Gracias, un moderador lo revisará.', 'exito');
  });
}
