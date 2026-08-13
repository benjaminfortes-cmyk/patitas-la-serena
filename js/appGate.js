// ============================================================================
// Puerta de entrada de la app de Google Play.
//
// En la web nadie se registra: se publica como invitado y listo. En la app de
// Android, en cambio, entrar con Google es obligatorio — es lo que la hace
// distinta del sitio y lo que permite que cada persona recupere sus reportes
// aunque cambie de teléfono.
//
// El detalle bonito: el TWA comparte el almacenamiento del Chrome del teléfono,
// así que si la persona YA publicó como invitada desde el navegador, esa sesión
// anónima sigue viva acá. Al entrar con Google se le engancha la identidad al
// mismo usuario (ver signInPublicoConGoogle) y sus reportes de antes siguen
// siendo suyos. No pierde nada por instalar la app.
//
// La puerta no se puede cerrar: no hay botón de "después". Esa es la decisión.
// ============================================================================
import { esAppAndroid } from './appMode.js';
import { onAuthChange, signInPublicoConGoogle } from './auth.js';
import { isConfigured } from './supabase.js';
import { toast } from './ui.js';

// Se marca antes de irse al OAuth: la vuelta de Google recarga la página entera
// y sin esto no habría cómo saber que veníamos de una sesión de invitado.
const CLAVE_VINCULANDO = 'bh-vinculando';

let overlay = null;

export function initAppGate() {
  // En modo demo (sin backend) no hay con qué registrarse: no estorbamos.
  if (!isConfigured || !esAppAndroid()) return;

  // La portada promete "Sin registro" — cierto en la web, mentira acá dentro.
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

  // Si ya venía publicando como invitada, se lo decimos: es la diferencia entre
  // "me están pidiendo datos" y "esto me sirve para no perder lo que hice".
  const invitado = !!user?.is_anonymous;
  const gancho = invitado
    ? 'Los reportes que ya publicaste quedarán guardados en tu cuenta.'
    : 'Así puedes editar tus reportes desde cualquier teléfono.';

  overlay = document.createElement('div');
  overlay.className = 'gate';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Entrar a Busca Huellitas');
  // Todo el texto es nuestro (nada viene del usuario): no hay qué escapar.
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

  // signInPublicoConGoogle redirige a Google, así que normalmente no se llega
  // acá. Si se llega, algo falló y hay que poder reintentar.
  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-google-logo" aria-hidden="true"></i> Continuar con Google';
}

function cerrar() {
  overlay?.remove();
  overlay = null;
}
