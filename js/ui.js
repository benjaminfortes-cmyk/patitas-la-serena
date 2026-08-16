// Pequeños helpers de interfaz reutilizables (toasts, escape de HTML).

export function toast(mensaje, tipo = 'info') {
  const cont = document.getElementById('toasts');
  if (!cont) return alert(mensaje);
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.setAttribute('role', 'status');
  el.textContent = mensaje;
  cont.appendChild(el);
  setTimeout(() => { el.classList.add('toast--out'); }, 3200);
  setTimeout(() => { el.remove(); }, 3600);
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
