// ============================================================================
// Borrar mi cuenta
//
// Google Play exige que quien se registra pueda borrar su cuenta desde dentro
// de la app, y que se le explique claramente qué se elimina. Se borra todo:
// la cuenta y los reportes que publicó, con sus fotos.
//
// El borrado real lo hace la Edge Function `borrar-cuenta`, que es la única
// con permisos para eliminar de auth.users. Desde acá solo se la llama.
//
// Solo aplica a cuentas registradas. Quien anda con sesión anónima no tiene
// nada que borrar: le basta con borrar los datos del navegador.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { getUser, signOut } from './auth.js';
import { toast } from './ui.js';

const PALABRA = 'BORRAR';

/** ¿Esta persona tiene una cuenta que borrar? (las anónimas no) */
export function tieneCuenta() {
  const u = getUser();
  return isConfigured && !!u && !u.is_anonymous;
}

export function abrirBorrarCuenta() {
  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  // Texto propio, nada viene del usuario.
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Borrar mi cuenta">
      <div class="matches__head">
        <h3>Borrar mi cuenta</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Esto no se puede deshacer. Se eliminará de forma permanente:</p>

      <ul class="borrar-lista">
        <li><i class="ph ph-user-circle" aria-hidden="true"></i> Tu cuenta y el vínculo con tu correo de Google.</li>
        <li><i class="ph ph-image" aria-hidden="true"></i> Todos los reportes que publicaste, con sus fotos.</li>
        <li><i class="ph ph-bell" aria-hidden="true"></i> Tus alertas por zona y tus avistamientos.</li>
      </ul>

      <p class="borrar-aviso">
        <i class="ph ph-warning" aria-hidden="true"></i>
        Si tienes una búsqueda activa, tu reporte desaparecerá del mapa y nadie
        podrá avisarte si encuentra a tu mascota.
      </p>

      <div class="form__group" style="margin-bottom:12px">
        <label for="borrar-confirmar">Para confirmar, escribe <b>${PALABRA}</b></label>
        <input type="text" id="borrar-confirmar" class="input" maxlength="10"
               autocomplete="off" autocapitalize="characters" placeholder="${PALABRA}" />
      </div>

      <button class="btn btn--peligro" id="borrar-ok" style="width:100%" disabled>
        <i class="ph ph-trash" aria-hidden="true"></i> Borrar mi cuenta para siempre
      </button>
      <button class="btn btn--ghost" data-close style="width:100%; margin-top:8px">
        Mejor no, volver
      </button>
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', cerrar));

  // El botón se activa solo al escribir la palabra: un borrado permanente no
  // puede quedar a un toque de distancia.
  const campo = overlay.querySelector('#borrar-confirmar');
  const boton = overlay.querySelector('#borrar-ok');
  campo.addEventListener('input', () => {
    boton.disabled = campo.value.trim().toUpperCase() !== PALABRA;
  });

  boton.addEventListener('click', () => borrar(boton, cerrar));
}

async function borrar(boton, cerrar) {
  boton.disabled = true;
  boton.innerHTML = '<i class="ph ph-circle-notch" aria-hidden="true"></i> Borrando…';

  try {
    // invoke() manda solo el token de la sesión actual: la función del servidor
    // borra a quien llama y a nadie más.
    const { error } = await supabase.functions.invoke('borrar-cuenta', { method: 'POST' });
    if (error) throw error;

    await signOut();
    cerrar();
    toast('Tu cuenta y tus reportes fueron eliminados.', 'exito');
    // Recarga limpia: sin sesión y sin nada suyo en pantalla.
    setTimeout(() => { location.href = location.pathname; }, 1500);
  } catch (e) {
    console.error('No se pudo borrar la cuenta:', e);
    boton.disabled = false;
    boton.innerHTML = '<i class="ph ph-trash" aria-hidden="true"></i> Borrar mi cuenta para siempre';
    toast('No se pudo borrar la cuenta. Escríbenos por Soporte y lo hacemos nosotros.', 'error');
  }
}
