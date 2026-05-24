// ============================================================================
// Registro del Service Worker (PWA: instalable + offline).
// ============================================================================

export function initPWA() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('No se pudo registrar el service worker:', err));
  });
}
