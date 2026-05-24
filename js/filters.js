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
  // Chips de estado y de animal (atributo data-filter / data-value)
  document.querySelectorAll('[data-filter="kind"], [data-filter="animal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const arr = btn.dataset.filter === 'kind' ? filterState.kinds : filterState.animals;
      toggle(arr, btn.dataset.value);
      btn.classList.toggle('chip--active');
      btn.setAttribute('aria-pressed', btn.classList.contains('chip--active'));
      onChange();
    });
  });

  // Selector de antigüedad (radio-like: solo uno activo)
  document.querySelectorAll('[data-filter="age"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.age = btn.dataset.value;
      document.querySelectorAll('[data-filter="age"]').forEach((b) => {
        const activo = b === btn;
        b.classList.toggle('chip--active', activo);
        b.setAttribute('aria-pressed', activo);
      });
      onChange();
    });
  });

  // Buscador
  const input = document.getElementById('search');
  input?.addEventListener('input', debounce(() => {
    filterState.query = input.value.trim();
    onChange();
  }));
}
