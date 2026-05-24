// ============================================================================
// Autenticación con Google (Supabase Auth).
//
// En MODO DEMO (sin backend) simula un usuario para poder probar el flujo
// de publicar sin configurar nada.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { escapeHtml } from './ui.js';

let currentUser = null;
const listeners = new Set();

export function getUser() { return currentUser; }

// Suscribe un callback a cambios de sesión (se llama de inmediato con el estado actual).
export function onAuthChange(cb) { listeners.add(cb); cb(currentUser); }
function emit() { listeners.forEach((cb) => cb(currentUser)); }

export async function initAuth() {
  if (!isConfigured) { emit(); return; }

  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  emit();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    emit();
  });
}

export async function signIn() {
  if (!isConfigured) {
    // Demo: usuario falso en memoria
    currentUser = { id: 'demo-user', user_metadata: { full_name: 'Usuario Demo' } };
    emit();
    return;
  }
  // OAuth con Google; al volver, Supabase restablece la sesión.
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href.split('#')[0] },
  });
}

export async function signOut() {
  if (!isConfigured) { currentUser = null; emit(); return; }
  await supabase.auth.signOut();
}

// Primer nombre para mostrar en la barra.
export function displayName() {
  const u = currentUser;
  if (!u) return null;
  const n = u.user_metadata?.full_name || u.user_metadata?.name || u.email || 'Tú';
  return n.split(' ')[0];
}

// ---- Interfaz del botón de sesión ----------------------------------------
export function initAuthUI() {
  const btn = document.getElementById('btn-login');

  onAuthChange((user) => {
    btn.innerHTML = user
      ? `<i class="ph ph-user-circle" aria-hidden="true"></i><span>${escapeHtml(displayName())}</span>`
      : `<i class="ph ph-sign-in" aria-hidden="true"></i><span>Ingresar</span>`;
  });

  btn.addEventListener('click', () => {
    if (getUser()) toggleMenu(btn);
    else signIn();
  });
}

// Pequeño menú con "Cerrar sesión".
function toggleMenu(btn) {
  let menu = document.getElementById('user-menu');
  if (menu) { menu.remove(); return; }

  menu = document.createElement('div');
  menu.id = 'user-menu';
  menu.className = 'user-menu';
  menu.innerHTML = `
    <button type="button" class="user-menu__item" data-alertas>
      <i class="ph ph-bell" aria-hidden="true"></i> Alertas por zona
    </button>
    <button type="button" class="user-menu__item" data-signout>
      <i class="ph ph-sign-out" aria-hidden="true"></i> Cerrar sesión
    </button>`;
  document.body.appendChild(menu);

  menu.querySelector('[data-alertas]').addEventListener('click', () => {
    menu.remove();
    window.openAlertas?.();
  });

  const r = btn.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.right = `${window.innerWidth - r.right}px`;

  menu.querySelector('[data-signout]').addEventListener('click', async () => {
    await signOut();
    menu.remove();
  });
  // Cerrar al hacer click fuera
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!menu.contains(e.target) && e.target !== btn) { menu.remove(); document.removeEventListener('click', close); }
    });
  }, 0);
}
