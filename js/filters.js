// ============================================================================
// Filtros y buscador. Mantiene el estado y avisa con un callback cada vez
// que cambia, para que app.js recargue los reportes.
//
// Los controles flotan sobre el mapa: los cuatro estados siempre a la vista
// (con el color de su pin) y, en "Más filtros", el animal y el tiempo.
// ============================================================================

export const filterState = {
  kinds: [],     // ['perdido','encontrado','avistado'] — vacío = todos
  animals: [],   // ['perro','gato','otro']            — vacío = todos
  age: 'all',
  query: '',
};

let onChange = () => {};
export function onFiltersChange(cb) { onChange = cb; }

// Marca una sola opción del grupo (los filtros son de una opción a la vez).
function marcar(botones, elegido, claseActiva) {
  botones.forEach((b) => {
    const activo = b === elegido;
    b.classList.toggle(claseActiva, activo);
    b.setAttribute('aria-pressed', String(activo));
  });
}

// Deja el mapa mostrando un solo tipo de reporte (lo usa "Quiero adoptar", que
// entra directo a los rescatados que buscan familia). Mueve también la pastilla
// para que se vea qué filtro quedó puesto.
export function filtrarPorTipo(kind) {
  filterState.kinds = kind ? [kind] : [];
  const estados = [...document.querySelectorAll('.estado')];
  const elegido = estados.find((b) => b.dataset.estado === (kind ?? ''));
  if (elegido) marcar(estados, elegido, 'estado--activo');
  onChange();
}

// Pequeño debounce para el buscador (no consultar en cada tecla).
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function initFilters() {
  // Estado: las cuatro pastillas de color, siempre a la vista
  const estados = [...document.querySelectorAll('.estado')];
  estados.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.estado;
      filterState.kinds = val ? [val] : [];
      marcar(estados, btn, 'estado--activo');
      onChange();
    });
  });

  // Animal y tiempo: viven dentro de "Más filtros"
  const animales = [...document.querySelectorAll('[data-animal]')];
  animales.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.animal;
      filterState.animals = val ? [val] : [];
      marcar(animales, btn, 'opcion--activa');
      contarPuestos();
      onChange();
    });
  });

  const tiempos = [...document.querySelectorAll('[data-tiempo]')];
  tiempos.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.age = btn.dataset.tiempo;
      marcar(tiempos, btn, 'opcion--activa');
      contarPuestos();
      onChange();
    });
  });

  // Buscador
  const input = document.getElementById('search');
  input?.addEventListener('input', debounce(() => {
    filterState.query = input.value.trim();
    onChange();
  }));

  initMasFiltros();
}

// ---- "Más filtros": hoja abajo en el celular, tarjetita al lado en el PC ----
const ANCHA = window.matchMedia('(min-width: 641px)');

function initMasFiltros() {
  const boton = document.getElementById('btn-mas-filtros');
  const panel = document.getElementById('mas-filtros-panel');
  const velo = document.getElementById('mas-filtros-velo');
  if (!boton || !panel || !velo) return;

  const abrir = (v) => {
    if (v) {
      // Al abrirse se muda al <body>: dentro de los filtros quedaba encerrado
      // en la capa del mapa y la barra de abajo del celular le tapaba el botón.
      if (panel.parentElement !== document.body) document.body.append(velo, panel);
      // En el computador es una tarjetita colgada del botón, así que hay que
      // decirle dónde: en el celular ocupa todo el ancho y lo pone el CSS.
      if (ANCHA.matches) {
        const r = boton.getBoundingClientRect();
        panel.style.left = `${r.left}px`;
        panel.style.top = `${r.bottom + 8}px`;
      } else {
        panel.style.left = '';
        panel.style.top = '';
      }
    }
    panel.classList.toggle('mas-panel--abierto', v);
    velo.classList.toggle('mas-velo--visible', v);
    boton.setAttribute('aria-expanded', String(v));
  };

  // Si cambia el tamaño de la ventana, la tarjetita quedaría colgada en el aire.
  window.addEventListener('resize', () => abrir(false));

  boton.addEventListener('click', (e) => {
    e.stopPropagation();
    abrir(!panel.classList.contains('mas-panel--abierto'));
  });
  velo.addEventListener('click', () => abrir(false));
  document.getElementById('btn-mas-filtros-listo')?.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrir(false); });

  // En el computador es una tarjetita flotante: se cierra al tocar el mapa.
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => abrir(false));
}

// El globito rojo del botón dice cuántos filtros escondidos quedaron puestos:
// si no, se olvidan y el mapa parece vacío sin motivo.
function contarPuestos() {
  const n = (filterState.animals.length ? 1 : 0) + (filterState.age !== 'all' ? 1 : 0);
  const globo = document.getElementById('mas-filtros-cuenta');
  if (!globo) return;
  globo.textContent = String(n);
  globo.hidden = n === 0;
}
