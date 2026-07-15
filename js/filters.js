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
  // Animal (desplegable con íconos, una opción; vacío = todos)
  const ddAnimal = document.getElementById('dd-animal');
  if (ddAnimal) {
    const trigger = ddAnimal.querySelector('.dropdown__trigger');
    const panel = ddAnimal.querySelector('.dropdown__panel');
    const label = ddAnimal.querySelector('.dropdown__label');
    const triggerIcon = trigger.querySelector('i');

    // El panel se "porta" al body al abrir, así ningún overflow (el scroll de
    // filtros en el celular) lo recorta ni lo esconde.
    const abrir = (v) => {
      trigger.setAttribute('aria-expanded', String(v));
      if (v) {
        document.body.appendChild(panel);
        panel.hidden = false;
        const r = trigger.getBoundingClientRect();
        const w = panel.offsetWidth || 176;
        panel.style.top = `${r.bottom + 6}px`;
        panel.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - w - 8)}px`;
      } else {
        panel.hidden = true;
      }
    };

    trigger.addEventListener('click', (e) => { e.stopPropagation(); abrir(panel.hidden); });
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => abrir(false));
    window.addEventListener('resize', () => abrir(false));

    panel.querySelectorAll('.dropdown__opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        const val = opt.dataset.animal;
        filterState.animals = val ? [val] : [];
        panel.querySelectorAll('.dropdown__opt').forEach((o) =>
          o.classList.toggle('dropdown__opt--active', o === opt));
        // el trigger refleja lo elegido (ícono + nombre)
        label.textContent = val ? opt.textContent.trim() : 'Animal';
        triggerIcon.className = val ? (opt.querySelector('i').className) : 'ph ph-paw-print';
        abrir(false);
        onChange();
      });
    });
  }

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
