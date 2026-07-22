// ============================================================================
// Visor de fotos: abre una imagen a pantalla completa al tocarla.
// Lo usa la ficha del reporte.
// ============================================================================
import { escapeHtml } from './ui.js';

let visor;

// Cierra con Escape antes que nadie: si no, el mismo Escape cerraría también
// la ficha que está detrás y el usuario perdería el reporte que estaba viendo.
function alPresionarTecla(e) {
  if (e.key !== 'Escape') return;
  e.stopPropagation();
  cerrarVisor();
}

export function abrirVisor(src, alt = '') {
  cerrarVisor();

  visor = document.createElement('div');
  visor.className = 'viewer';
  visor.setAttribute('role', 'dialog');
  visor.setAttribute('aria-modal', 'true');
  visor.setAttribute('aria-label', alt || 'Foto del reporte');
  visor.innerHTML = `
    <button class="viewer__close" type="button" aria-label="Cerrar foto">&times;</button>
    <img class="viewer__img" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;

  visor.addEventListener('click', (e) => {
    // Tocar la foto no cierra; tocar el fondo o la X, sí.
    if (!e.target.classList.contains('viewer__img')) cerrarVisor();
  });

  document.body.appendChild(visor);
  document.addEventListener('keydown', alPresionarTecla, true);
  visor.querySelector('.viewer__close').focus();
}

export function cerrarVisor() {
  document.removeEventListener('keydown', alPresionarTecla, true);
  visor?.remove();
  visor = null;
}

// Deja una foto lista para abrirse en grande (click o Enter).
export function hacerAmpliable(img, alt) {
  if (!img) return;
  img.classList.add('is-zoomable');
  img.tabIndex = 0;
  img.setAttribute('role', 'button');
  img.title = 'Toca para ver la foto en grande';
  img.addEventListener('click', () => abrirVisor(img.src, alt ?? img.alt));
  img.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirVisor(img.src, alt ?? img.alt); }
  });
}
