// ============================================================================
// Ficha del reporte (bottom-sheet que se abre al tocar un marcador).
//
// Incluye: foto + datos, contacto por WhatsApp, Compartir (Web Share API con
// fallback a copiar), denuncia de info incorrecta/duplicada, y —si es del
// usuario logueado— botones "Marcar como resuelto ❤️" y "Editar".
// ============================================================================
import { KIND_META, nombreAnimal, tiempoRelativo, tituloReporte } from './constants.js';
import { escapeHtml, toast } from './ui.js';
import { getUser, signIn } from './auth.js';
import { supabase, isConfigured } from './supabase.js';
import { DEMO_REPORTS } from './demo.js';

const SIZE_LABEL = { chico: 'Chico', mediano: 'Mediano', grande: 'Grande' };

// Link de WhatsApp con mensaje pre-redactado.
function whatsappLink(report) {
  const num = report.contact_whatsapp.replace(/[^0-9]/g, ''); // 569XXXXXXXX
  const msg = `Hola, vi tu publicación en Patitas La Serena sobre ${tituloReporte(report)}. ¿Sigue activa la búsqueda?`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export function openReportCard(report) {
  const sheet = document.getElementById('detail');
  const k = KIND_META[report.kind];
  const resuelto = report.lifecycle === 'resuelto';
  const user = getUser();
  const esDueno = user && report.user_id && report.user_id === user.id;

  const fila = (label, val) =>
    val ? `<div class="detail__row"><dt>${label}</dt><dd>${escapeHtml(val)}</dd></div>` : '';

  // Botones de dueño (resolver / editar / sigue activo) solo si es su reporte y no está resuelto.
  const accionesDueno = (esDueno && !resuelto) ? `
    <div class="detail__owner">
      <button class="btn btn--soft" data-action="resolver"><i class="ph ph-heart"></i> Marcar como resuelto</button>
      <button class="btn btn--outline" data-action="editar"><i class="ph ph-pencil-simple"></i> Editar</button>
    </div>
    <button class="btn btn--ghost detail__keepalive" data-action="reactivar">
      <i class="ph ph-arrow-clockwise"></i> Sigue activo (reiniciar caducidad)
    </button>` : '';

  sheet.innerHTML = `
    <button class="sheet__close" aria-label="Cerrar" data-close>&times;</button>
    <div class="detail__photo">
      <img src="${escapeHtml(report.photo_url)}"
           alt="Foto de ${escapeHtml(tituloReporte(report))}" loading="lazy" />
      <span class="badge" style="--badge:${k.color}">${k.emoji} ${k.label}</span>
      ${resuelto ? '<span class="badge badge--reunidos">❤️ ¡Reunidos!</span>' : ''}
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
    title: 'Patitas La Serena',
    text: `Ayuda con ${tituloReporte(report)} en Patitas La Serena`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(datos); } catch { /* el usuario canceló */ }
  } else {
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado 📋', 'exito'); }
    catch { toast(url, 'info'); }
  }
}

// ---- Marcar como resuelto -------------------------------------------------
async function resolver(report) {
  if (!confirm('¿Marcar como resuelto? Quedará 7 días con el corazón ❤️ y luego se archiva.')) return;

  if (isConfigured) {
    const { error } = await supabase.rpc('mark_resolved', { p_report_id: report.id });
    if (error) return toast(error.message, 'error');
  } else {
    const r = DEMO_REPORTS.find((x) => x.id === report.id);
    if (r) { r.lifecycle = 'resuelto'; r.resolved_at = new Date().toISOString(); }
  }
  toast('¡Reunidos! Gracias por avisar 🎉', 'exito');
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
  toast('Listo, tu reporte sigue activo 👍', 'exito');
}

// ---- Denuncia (info incorrecta / duplicada) -------------------------------
function abrirDenuncia(report) {
  if (isConfigured && !getUser()) {
    toast('Inicia sesión para reportar.', 'info');
    return signIn();
  }

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
