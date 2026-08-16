// Puerta de entrada de la app de Google Play.

import { esAppAndroid } from './appMode.js';
import { onAuthChange, signInPublicoConGoogle } from './auth.js';
import { isConfigured } from './supabase.js';
import { toast } from './ui.js';

const CLAVE_VINCULANDO = 'bh-vinculando';

let overlay = null;

export function initAppGate() {
  if (!isConfigured || !esAppAndroid()) return;

  const cierre = document.getElementById('infobar-cierre');
  if (cierre) cierre.innerHTML = '<b>Tus reportes</b> quedan guardados en tu cuenta.';

  onAuthChange((user) => {
    const registrado = !!user && !user.is_anonymous;

    if (!registrado) { abrir(user); return; }

    cerrar();
    try {
      if (sessionStorage.getItem(CLAVE_VINCULANDO) === '1') {
        sessionStorage.removeItem(CLAVE_VINCULANDO);
        toast('Listo. Los reportes que publicaste antes siguen siendo tuyos.', 'exito');
      }
    } catch { /* modo incógnito */ }
  });
}

function abrir(user) {
  if (overlay) return;

  const invitado = !!user?.is_anonymous;
  const gancho = invitado
    ? 'Los reportes que ya publicaste quedarán guardados en tu cuenta.'
    : 'Así puedes editar tus reportes desde cualquier teléfono.';

  overlay = document.createElement('div');
  overlay.className = 'gate';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Entrar a Busca Huellitas');
  overlay.innerHTML = `
    <div class="gate__card">
      <img class="gate__logo" src="assets/icons/icon-192.png" alt="" width="88" height="88" />
      <h2 class="gate__title">Bienvenido a Busca Huellitas</h2>
      <p class="gate__sub">Entra con tu cuenta de Google para empezar. ${gancho}</p>

      <button class="btn btn--primary gate__btn" id="gate-google">
        <i class="ph ph-google-logo" aria-hidden="true"></i> Continuar con Google
      </button>

      <p class="gate__legal">
        Solo usamos tu nombre y tu correo para identificar tus reportes.
        No publicamos nada en tu nombre.
        <a href="privacidad.html">Política de privacidad</a>
      </p>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#gate-google').addEventListener('click', entrar);
}

async function entrar(e) {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch" aria-hidden="true"></i> Abriendo Google…';

  try { sessionStorage.setItem(CLAVE_VINCULANDO, '1'); } catch { /* modo incógnito */ }

  await signInPublicoConGoogle();

  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-google-logo" aria-hidden="true"></i> Continuar con Google';
}

function cerrar() {
  overlay?.remove();
  overlay = null;
}
