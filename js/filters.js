// ============================================================================
// Filtros y buscador. Mantiene el estado y avisa con un callback cada vez
// que cambia, para que app.js recargue los reportes.
// ============================================================================

export const filterState = {
  kinds: [],     // ['perdido','encontrado','avistado'] — vacío = todos
  animals: [],   // ['perro','gato','otro']            — vacío = todos
  age: 'all',
  query: '',
};

let onChange = () => {};
export function onFiltersChange(cb) { onChange = cb; }

// Pequeño debounce para el buscador (no consultar en cada tecla).
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Alterna un valor dentro de un arreglo del estado (chips multi-selección).
function toggle(arr, value) {
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(value);
}

export function initFilters() {
  // Especie (perro/gato/otro): botones de selección múltiple
  document.querySelectorAll('[data-filter="animal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggle(filterState.animals, btn.dataset.value);
      btn.classList.toggle('chip--active');
      btn.setAttribute('aria-pressed', btn.classList.contains('chip--active'));
      onChange();
    });
  });

  // Estado (desplegable: una opción; vacío = todos)
  const estado = document.getElementById('filter-estado');
  estado?.addEventListener('change', () => {
    filterState.kinds = estado.value ? [estado.value] : [];
    onChange();
  });

  // Tiempo (desplegable: una opción)
  const tiempo = document.getElementById('filter-tiempo');
  tiempo?.addEventListener('change', () => {
    filterState.age = tiempo.value;
    onChange();
  });

  // Buscador
  const input = document.getElementById('search');
  input?.addEventListener('input', debounce(() => {
    filterState.query = input.value.trim();
    onChange();
  }));
}
