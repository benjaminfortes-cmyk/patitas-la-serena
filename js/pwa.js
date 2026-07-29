// ============================================================================
// PWA: registro del Service Worker (instalable + offline) y botón "Instalar".
//
// Mucha gente no sabe que un sitio se puede dejar como app en el teléfono, así
// que no dejamos la instalación escondida en el menú del navegador: mostramos
// un botón arriba y una tarjeta en la portada.
//
// Chrome/Edge (Android y escritorio) avisan con 'beforeinstallprompt' y ahí
// podemos abrir el diálogo nativo. Safari (iPhone/Mac) y Firefox no lo tienen:
// para esos casos abrimos un modal explicando el paso a paso.
// ============================================================================
import { toast } from './ui.js';

// El evento llega solo una vez y hay que guardarlo para usarlo al hacer clic.
// Se escucha a nivel de módulo (no dentro de initPWA) porque el navegador puede
// dispararlo antes de que termine de armarse la página.
let promptDiferido = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();          // sin esto Chrome muestra su propio aviso
  promptDiferido = e;
  mostrarBotones();
});

window.addEventListener('appinstalled', () => {
  promptDiferido = null;
  ocultarBotones();
  toast('¡Listo! Busca Huellitas quedó instalada en tu dispositivo.', 'exito');
});

export function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .catch((err) => console.warn('No se pudo registrar el service worker:', err));
    });
  }

  document.getElementById('btn-instalar')?.addEventListener('click', instalar);
  document.getElementById('card-instalar')?.addEventListener('click', instalar);

  // Si ya está instalada (se abrió desde el ícono), no hay nada que ofrecer.
  if (!yaInstalada()) mostrarBotones();
}

// ---- Estado de los botones -------------------------------------------------

function yaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;   // Safari iOS
}

function mostrarBotones() {
  if (yaInstalada()) return;
  document.getElementById('btn-instalar')?.removeAttribute('hidden');
  document.getElementById('card-instalar')?.removeAttribute('hidden');
}

function ocultarBotones() {
  document.getElementById('btn-instalar')?.setAttribute('hidden', '');
  document.getElementById('card-instalar')?.setAttribute('hidden', '');
}

// ---- Instalación -----------------------------------------------------------

async function instalar() {
  // Camino bueno: Chrome/Edge nos dejó el diálogo nativo guardado.
  if (promptDiferido) {
    const evento = promptDiferido;
    promptDiferido = null;              // el evento sirve una sola vez
    evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'accepted') ocultarBotones();
    else toast('No pasa nada: puedes instalarla cuando quieras desde este botón.', 'info');
    return;
  }
  // Resto de navegadores: explicamos el paso a paso.
  abrirInstrucciones();
}

// ---- Instrucciones manuales ------------------------------------------------

function esIOS() {
  const ua = navigator.userAgent;
  // iPadOS se hace pasar por Mac: se delata porque la pantalla es táctil.
  return /iphone|ipad|ipod/i.test(ua)
      || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const esAndroid = () => /android/i.test(navigator.userAgent);
const esFirefox = () => /firefox|fxios/i.test(navigator.userAgent);

// Devuelve { titulo, pasos[], nota } según el navegador de quien está mirando.
function instrucciones() {
  if (esIOS()) {
    return {
      titulo: 'Instalar en tu iPhone o iPad',
      pasos: [
        'Abre buscahuellitas.cl en <b>Safari</b> (si estás en otro navegador, cópialo allí).',
        'Toca el botón <b>Compartir</b> <i class="ph ph-export"></i>, el cuadrito con la flecha hacia arriba.',
        'Desliza y elige <b>«Agregar a pantalla de inicio»</b>.',
        'Toca <b>Agregar</b>. El ícono queda junto a tus otras apps.',
      ],
      nota: 'En iPhone la instalación siempre es manual: Apple no permite un botón automático.',
    };
  }
  if (esAndroid()) {
    return {
      titulo: 'Instalar en tu Android',
      pasos: [
        'Toca el menú <b>⋮</b> arriba a la derecha del navegador.',
        'Elige <b>«Instalar aplicación»</b> o <b>«Agregar a pantalla de inicio»</b>.',
        'Confirma con <b>Instalar</b>. El ícono queda junto a tus otras apps.',
      ],
      nota: esFirefox() ? 'Con Chrome la instalación es de un toque, si quieres probarlo.' : '',
    };
  }
  return {
    titulo: 'Instalar en tu computador',
    pasos: [
      'En <b>Chrome o Edge</b>: toca el ícono de instalar <i class="ph ph-download-simple"></i> al final de la barra de direcciones, o el menú <b>⋮</b> → <b>«Instalar Busca Huellitas»</b>.',
      'En <b>Safari (Mac)</b>: menú <b>Archivo</b> → <b>«Añadir al Dock»</b>.',
      'Confirma con <b>Instalar</b>. Se abre en su propia ventana, como cualquier programa.',
    ],
    nota: esFirefox() ? 'Firefox de escritorio no permite instalar sitios: ábrelo en Chrome o Edge.' : '',
  };
}

function abrirInstrucciones() {
  const { titulo, pasos, nota } = instrucciones();

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  // Todo el texto es nuestro (no viene del usuario): no hay nada que escapar.
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="${titulo}">
      <div class="matches__head">
        <h3>${titulo}</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Queda como una app: se abre desde el ícono, a pantalla completa y sin barra del navegador. No ocupa casi nada y funciona aunque estés sin señal.</p>
      <ol class="instalar-pasos">${pasos.map((p) => `<li>${p}</li>`).join('')}</ol>
      ${nota ? `<p class="instalar-nota"><i class="ph ph-info" aria-hidden="true"></i> ${nota}</p>` : ''}
      <button class="btn btn--primary" data-close style="width:100%">Entendido</button>
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', cerrar));
}
