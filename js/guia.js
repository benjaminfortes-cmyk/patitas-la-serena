// ============================================================================
// Guía del mapa: explica qué significa el color de cada pin.
// Se abre desde la barra inferior (móvil).
// ============================================================================
import { KIND_META } from './constants.js';

// Cada fila arma su pin con el MISMO color que usa el mapa. Así la guía no
// puede quedar desfasada si algún día se cambian los colores.
const LEYENDA = [
  {
    clase: '', color: KIND_META.perdido.color, icono: 'ph-dog',
    titulo: KIND_META.perdido.label,
    texto: 'Su familia lo está buscando. Si lo viste, escríbeles por WhatsApp.',
  },
  {
    clase: '', color: KIND_META.encontrado.color, icono: 'ph-house-line',
    titulo: KIND_META.encontrado.label,
    texto: 'Alguien lo rescató y lo tiene a salvo, pero su familia todavía no aparece.',
  },
  {
    clase: '', color: KIND_META.avistado.color, icono: 'ph-eye',
    titulo: KIND_META.avistado.label,
    texto: 'Lo vieron suelto en la calle, pero no alcanzaron a acercarse a él.',
  },
  {
    // El color lo pone la clase pin--resuelto (var --reunidos), igual que en el mapa.
    clase: 'pin--resuelto', color: '', icono: 'ph-heart',
    titulo: 'Reunidos con familia',
    texto: 'Volvió a casa. Queda 7 días en el mapa como final feliz y luego se archiva.',
  },
];

export function initGuia() {
  window.openGuia = abrir;
}

function abrir() {
  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';

  const filas = LEYENDA.map((l) => `
    <li class="leyenda__item">
      <span class="pin ${l.clase}" ${l.color ? `style="--pin:${l.color}"` : ''} aria-hidden="true">
        <span class="pin__icon"><i class="ph-fill ${l.icono}"></i></span>
      </span>
      <span class="leyenda__txt">
        <b>${l.titulo}</b>
        <small>${l.texto}</small>
      </span>
    </li>`).join('');

  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Guía del mapa">
      <div class="matches__head">
        <h3>¿Qué significa cada color?</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">El color del pin te dice en qué situación está el animal.</p>
      <ul class="leyenda">${filas}</ul>
      <p class="leyenda__pie">
        <i class="ph ph-paw-print" aria-hidden="true"></i>
        El dibujo dentro del pin indica si es un perro, un gato u otro animal.
      </p>
    </div>`;

  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);
}
