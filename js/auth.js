// Sesión anónima (Supabase Auth).

import { supabase, isConfigured } from './supabase.js';
import { escapeHtml } from './ui.js';

let currentUser = null;
let rol = 'user';
let organizacion = null;
const listeners = new Set();

export function getUser() { return currentUser; }

export function isAdminUser() { return rol === 'admin'; }

export function isStaffUser() { return rol === 'admin' || rol === 'colaborador'; }

export function getOrgName() { return organizacion; }

async function refreshRol() {
  if (!isConfigured || !currentUser) { rol = 'user'; organizacion = null; return; }

  let { data, error } = await supabase
    .from('profiles').select('role, org_name').eq('id', currentUser.id).maybeSingle();

  if (error) {
    ({ data, error } = await supabase
      .from('profiles').select('role').eq('id', currentUser.id).maybeSingle());
  }

  rol = (!error && data?.role) || 'user';
  organizacion = (!error && data?.org_name) || null;
}

export function onAuthChange(cb) { listeners.add(cb); cb(currentUser); }
function emit() { listeners.forEach((cb) => cb(currentUser)); }

export async function initAuth() {
  if (!isConfigured) { emit(); return; }

  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  await refreshRol();
  emit();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    await refreshRol();
    emit();
  });

  // La sesión no se crea acá: la crea ensureSession() al publicar o al activar
  // las alertas. Crearla al entrar es un usuario nuevo por cada visita.
}

export async function ensureSession() {
  if (!isConfigured) {
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
  await refreshRol();
  emit();
  return currentUser;
}

export async function signOut() {
  if (!isConfigured) { currentUser = null; rol = 'user'; organizacion = null; emit(); return; }
  await supabase.auth.signOut();
}

export async function signInWithGoogle() {
  if (!isConfigured) return;
  // Cerrar la sesión anónima antes del OAuth: si no, Google se vincula a ese
  // usuario en vez de entrar a la cuenta del equipo, y el rol nunca aparece.
  await supabase.auth.signOut();
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: volverA() },
  });
}

function volverA() { return window.location.href.split('#')[0]; }

export async function signInPublicoConGoogle() {
  if (!isConfigured) return;

  if (currentUser?.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: volverA() },
    });
    if (!error) return;
    console.warn('No se pudo vincular Google a la sesión de invitado:', error.message);
  }

  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: volverA() },
  });
}

export function displayName() {
  const u = currentUser;
  if (!u) return null;
  let n = u.user_metadata?.full_name || u.user_metadata?.name || '';
  if (!n && u.email) n = u.email.split('@')[0].replace(/[._\-+0-9]+/g, ' ');
  const primero = n.trim().split(/\s+/)[0];
  if (!primero) return null;
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

const ADMIN_FLAG = 'bh-admin';

export function initAdminAccess() {
  const params = new URLSearchParams(location.search);
  if (params.get('admin') === '1' || params.get('equipo') === '1') {
    sessionStorage.setItem(ADMIN_FLAG, '1');
  }

  let btn = null;

  const alClick = async () => {
    if (isStaffUser()) {
      sessionStorage.removeItem(ADMIN_FLAG);
      await signOut();
      location.href = location.pathname;
    } else {
      await signInWithGoogle();
    }
  };

  onAuthChange(() => {
    const dentro = isStaffUser();
    const pedido = sessionStorage.getItem(ADMIN_FLAG) === '1';

    if (!dentro && !pedido) { btn?.remove(); btn = null; return; }

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-admin';
      btn.className = 'btn btn--ghost btn--sm';
      btn.addEventListener('click', alClick);
      document.querySelector('.topbar__actions')?.appendChild(btn);
    }

    const quien = isAdminUser()
      ? (displayName() ?? 'Admin')
      : (getOrgName() ?? displayName() ?? 'Colaborador');

    btn.innerHTML = dentro
      ? `<i class="ph-fill ph-shield-check" aria-hidden="true"></i><span class="hide-mobile">${escapeHtml(quien)}</span>`
      : `<i class="ph ph-shield" aria-hidden="true"></i><span class="hide-mobile">Entrar</span>`;
    btn.title = dentro
      ? `Sesión de ${isAdminUser() ? 'administrador' : 'colaborador'} — click para salir`
      : 'Entrar con la cuenta del equipo';
  });
}
