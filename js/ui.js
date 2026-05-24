// ============================================================================
// Pequeños helpers de interfaz reutilizables (toasts, escape de HTML).
// ============================================================================

// Muestra un mensaje breve flotante. tipo: 'info' | 'exito' | 'error'
export function toast(mensaje, tipo = 'info') {
  const cont = document.getElementById('toasts');
  if (!cont) return alert(mensaje);
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.setAttribute('role', 'status');
  el.textContent = mensaje;
  cont.appendChild(el);
  // animación de salida y limpieza
  setTimeout(() => { el.classList.add('toast--out'); }, 3200);
  setTimeout(() => { el.remove(); }, 3600);
}

// Escapa texto del usuario antes de inyectarlo como HTML (anti-XSS).
export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
