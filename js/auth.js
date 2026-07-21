// ============================================================================
// Sesión anónima (Supabase Auth).
//
// Nadie tiene que registrarse: al abrir la app se crea una sesión anónima
// invisible. Eso le da a la persona un `user_id` real —y con él sus reportes,
// sus fotos y sus permisos— sin pedirle nombre, correo ni contraseña.
//
// Hay una sola excepción: el acceso de administrador, oculto tras ?admin=1.
// Ver initAdminAccess() al final del archivo.
//
// En MODO DEMO (sin backend) simula un usuario para poder probar el flujo
// de publicar sin configurar nada.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { escapeHtml } from './ui.js';

let currentUser = null;
let esAdmin = false;
const listeners = new Set();

export function getUser() { return currentUser; }
export function isAdminUser() { return esAdmin; }

// Consulta al backend si el usuario actual tiene rol de administrador.
// La función is_admin() vive en la base de datos y usa la tabla profiles.
async function refreshAdmin() {
  if (!isConfigured || !currentUser) { esAdmin = false; return; }
  const { data, error } = await supabase.rpc('is_admin');
  esAdmin = !error && data === true;
}

// Suscribe un callback a cambios de sesión (se llama de inmediato con el estado actual).
export function onAuthChange(cb) { listeners.add(cb); cb(currentUser); }
function emit() { listeners.forEach((cb) => cb(currentUser)); }

export async function initAuth() {
  if (!isConfigured) { emit(); return; }

  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  await refreshAdmin();
  emit();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    await refreshAdmin();
    emit();
  });

  // Sin sesión previa: creamos una anónima de inmediato, para que publicar
  // no tope con ninguna pantalla de por medio.
  if (!currentUser) await ensureSession();
}

/**
 * Devuelve el usuario actual y, si no hay ninguno, abre una sesión anónima.
 * Es el único punto de entrada a la sesión: no hay pantalla de login.
 */
export async function ensureSession() {
  if (!isConfigured) {
    // Demo: usuario falso en memoria
    if (!currentUser) {
      currentUser = { id: 'demo-user', user_metadata: { full_name: 'Usuario Demo' } };
      emit();
    }
    return currentUser;
  }
  if (currentUser) return currentUser;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('No se pudo iniciar la sesión anónima:', error.message);
    return null;
  }
  currentUser = data.user ?? null;
  await refreshAdmin();
  emit();
  return currentUser;
}

export async function signOut() {
  if (!isConfigured) { currentUser = null; esAdmin = false; emit(); return; }
  await supabase.auth.signOut();
}

/**
 * Entra con Google. Es exclusivo del acceso de administrador: el público
 * jamás llega acá.
 */
export async function signInWithGoogle() {
  if (!isConfigured) return;
  // Cerramos la sesión anónima ANTES de arrancar el OAuth. Si no, Supabase
  // vincula la identidad de Google al usuario anónimo actual en vez de entrar
  // a la cuenta de administrador que ya existe, y el rol nunca aparecería.
  await supabase.auth.signOut();
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    // Conserva el ?admin=1 al volver, para que el botón siga visible.
    options: { redirectTo: window.location.href.split('#')[0] },
  });
}

// Primer nombre de la persona, con formato prolijo. Las sesiones anónimas no
// tienen nombre: devuelve null y quien lo use decide qué mostrar.
export function displayName() {
  const u = currentUser;
  if (!u) return null;
  let n = u.user_metadata?.full_name || u.user_metadata?.name || '';
  if (!n && u.email) n = u.email.split('@')[0].replace(/[._\-+0-9]+/g, ' ');
  const primero = n.trim().split(/\s+/)[0];
  if (!primero) return null;
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

// ---- Acceso de administrador (oculto) --------------------------------------
// El público nunca ve un login. El botón aparece en dos casos:
//   1. Se abrió la app con ?admin=1 (para poder entrar).
//   2. La sesión actual YA es de un administrador (para poder salir).
// El caso 2 es clave: sin él, quien entra como admin queda atrapado en ese
// modo —viendo el botón "Borrar" en cada reporte— sin ninguna forma de salir.
// El público nunca cae en ninguno de los dos: siempre es anónimo.
//
// Los permisos reales los da la base de datos (profiles.role = 'admin'),
// no este botón.
const ADMIN_FLAG = 'bh-admin';

export function initAdminAccess() {
  if (new URLSearchParams(location.search).get('admin') === '1') {
    sessionStorage.setItem(ADMIN_FLAG, '1');
  }

  let btn = null;

  const alClick = async () => {
    if (isAdminUser()) {
      // Salir: volvemos a la app normal, con sesión anónima limpia.
      sessionStorage.removeItem(ADMIN_FLAG);
      await signOut();
      location.href = location.pathname;
    } else {
      await signInWithGoogle();
    }
  };

  onAuthChange(() => {
    const dentro = isAdminUser();
    const pedido = sessionStorage.getItem(ADMIN_FLAG) === '1';

    if (!dentro && !pedido) { btn?.remove(); btn = null; return; }

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-admin';
      btn.className = 'btn btn--ghost btn--sm';
      btn.addEventListener('click', alClick);
      document.querySelector('.topbar__actions')?.appendChild(btn);
    }

    // En el celular queda solo el escudo (hide-mobile): la barra ya lleva tres
    // botones y el nombre no cabe. El ícono relleno ya indica sesión activa.
    btn.innerHTML = dentro
      ? `<i class="ph-fill ph-shield-check" aria-hidden="true"></i><span class="hide-mobile">${escapeHtml(displayName() ?? 'Admin')}</span>`
      : `<i class="ph ph-shield" aria-hidden="true"></i><span class="hide-mobile">Admin</span>`;
    btn.title = dentro ? 'Sesión de administrador — click para salir' : 'Entrar como administrador';
  });
}

