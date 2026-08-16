// Filtros y buscador del mapa.

export const filterState = {
  kinds: [],     // ['perdido','encontrado','avistado'] — vacío = todos
  animals: [],   // ['perro','gato','otro']            — vacío = todos
  age: 'all',
  query: '',
};

let onChange = () => {};
export function onFiltersChange(cb) { onChange = cb; }

function marcar(botones, elegido, claseActiva) {
  botones.forEach((b) => {
    const activo = b === elegido;
    b.classList.toggle(claseActiva, activo);
    b.setAttribute('aria-pressed', String(activo));
  });
}

export function filtrarPorTipo(kind) {
  filterState.kinds = kind ? [kind] : [];
  const estados = [...document.querySelectorAll('.estado')];
  const elegido = estados.find((b) => b.dataset.estado === (kind ?? ''));
  if (elegido) marcar(estados, elegido, 'estado--activo');
  onChange();
}

function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function initFilters() {
  const estados = [...document.querySelectorAll('.estado')];
  estados.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.estado;
      filterState.kinds = val ? [val] : [];
      marcar(estados, btn, 'estado--activo');
      onChange();
    });
  });

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

  const input = document.getElementById('search');
  input?.addEventListener('input', debounce(() => {
    filterState.query = input.value.trim();
    onChange();
  }));

  initMasFiltros();
}

const ANCHA = window.matchMedia('(min-width: 641px)');

function initMasFiltros() {
  const boton = document.getElementById('btn-mas-filtros');
  const panel = document.getElementById('mas-filtros-panel');
  const velo = document.getElementById('mas-filtros-velo');
  if (!boton || !panel || !velo) return;

  const abrir = (v) => {
    if (v) {
      if (panel.parentElement !== document.body) document.body.append(velo, panel);
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

  window.addEventListener('resize', () => abrir(false));

  boton.addEventListener('click', (e) => {
    e.stopPropagation();
    abrir(!panel.classList.contains('mas-panel--abierto'));
  });
  velo.addEventListener('click', () => abrir(false));
  document.getElementById('btn-mas-filtros-listo')?.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrir(false); });

  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => abrir(false));
}

function contarPuestos() {
  const n = (filterState.animals.length ? 1 : 0) + (filterState.age !== 'all' ? 1 : 0);
  const globo = document.getElementById('mas-filtros-cuenta');
  if (!globo) return;
  globo.textContent = String(n);
  globo.hidden = n === 0;
}
