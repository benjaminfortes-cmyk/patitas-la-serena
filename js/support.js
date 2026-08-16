// Soporte por correo.

import { getUser, displayName } from './auth.js';
import { toast, escapeHtml } from './ui.js';
import { tieneCuenta, abrirBorrarCuenta } from './cuenta.js';

const SUPPORT_ENDPOINT = 'https://formsubmit.co/ajax/benjaminfortes88@gmail.com';

export function initSoporte() {
  document.getElementById('btn-soporte')?.addEventListener('click', abrir);
}

function abrir() {
  const user = getUser();

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Contactar al soporte">
      <div class="matches__head">
        <h3>Contactar al soporte</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">¿Encontraste un problema o tienes una sugerencia? Escríbenos y te responderemos al correo que indiques.</p>
      <div class="form__group" style="margin-bottom:12px">
        <label for="support-name">Tu nombre</label>
        <input type="text" id="support-name" class="input" maxlength="80"
               value="${user ? escapeHtml(displayName() ?? '') : ''}" placeholder="Ej: Benjamín" />
      </div>
      <div class="form__group" style="margin-bottom:12px">
        <label for="support-email">Tu correo <span class="req">*</span></label>
        <input type="email" id="support-email" class="input" maxlength="120"
               value="${user?.email ? escapeHtml(user.email) : ''}" placeholder="tucorreo@ejemplo.com" />
      </div>
      <div class="form__group" style="margin-bottom:12px">
        <label for="support-msg">Mensaje <span class="req">*</span></label>
        <textarea id="support-msg" class="input" rows="4" maxlength="1000"
                  placeholder="Cuéntanos qué pasó o qué necesitas…"></textarea>
      </div>
      <button class="btn btn--primary" id="support-send" style="width:100%">
        <i class="ph ph-paper-plane-tilt"></i> Enviar mensaje
      </button>
      ${tieneCuenta() ? `
      <div class="soporte__cuenta">
        <button class="soporte__borrar" id="support-borrar">Borrar mi cuenta y mis reportes</button>
      </div>` : ''}
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  overlay.querySelector('#support-send').addEventListener('click', () => enviar(overlay, cerrar));

  overlay.querySelector('#support-borrar')?.addEventListener('click', () => {
    cerrar();
    abrirBorrarCuenta();
  });
}

async function enviar(overlay, cerrar) {
  const nombre = overlay.querySelector('#support-name').value.trim();
  const correo = overlay.querySelector('#support-email').value.trim();
  const mensaje = overlay.querySelector('#support-msg').value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return toast('Revisa tu correo: no parece válido.', 'error');
  if (!mensaje) return toast('Escribe un mensaje antes de enviar.', 'error');

  const btn = overlay.querySelector('#support-send');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner"></i> Enviando…';

  try {
    const res = await fetch(SUPPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: nombre || 'Sin nombre',
        email: correo,
        message: mensaje,
        _subject: 'Soporte · Busca Huellitas',
        _template: 'table',
        _captcha: 'false',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || String(data.success) !== 'true') {
      throw new Error(data.message || 'El servicio de correo no respondió.');
    }
    cerrar();
    toast('Mensaje enviado. Te responderemos pronto.', 'exito');
  } catch (err) {
    toast('No se pudo enviar: ' + (err.message || 'intenta de nuevo.'), 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Enviar mensaje';
  }
}
