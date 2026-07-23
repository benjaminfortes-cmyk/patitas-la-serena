// ============================================================================
// Panel de estadísticas — SOLO ADMINISTRADORES
//
// Vive junto al acceso de admin: el botón aparece únicamente cuando la sesión
// tiene rol 'admin' (mismo criterio que usa auth.js), y los datos los trae la
// vista `reports_public`, que con RLS le muestra al admin TODOS los reportes,
// incluidos los archivados.
//
// Tiene dos vistas de la misma información, a propósito:
//   · "Para compartir"  -> todo en PORCENTAJES, dentro de una tarjeta 4:5 lista
//                          para sacarle un pantallazo y subirla a Instagram.
//   · "Interno"         -> números absolutos, medianas y una tabla completa.
//     Esa tabla es además la versión accesible de los gráficos de arriba:
//     ningún valor queda encerrado en un color.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { DEMO_REPORTS } from './demo.js';
import { isAdminUser, onAuthChange } from './auth.js';
import { KIND_META, ANIMAL_META } from './constants.js';
import { escapeHtml, toast } from './ui.js';

// Los colores son los MISMOS que usan los pines del mapa y los chips: quien ve
// el pantallazo ya aprendió que rojo = perdido. (Paleta validada para daltonismo;
// además cada categoría lleva su etiqueta al lado, nunca solo el color.)
const COLOR_KIND = {
  perdido: KIND_META.perdido.color,
  encontrado: KIND_META.encontrado.color,
  avistado: KIND_META.avistado.color,
};
const COLOR_ANIMAL = { perro: '#1f95b8', gato: '#CA8A04', otro: '#7C3AED' };
const VERDE = '#16A34A';   // reencuentros (var --reunidos)

const PERIODOS = [
  { valor: 'all', label: 'Todo' },
  { valor: '30d', label: '30 días', dias: 30 },
  { valor: '7d',  label: '7 días',  dias: 7  },
];

// Estado del panel mientras está abierto.
let reportes = [];
let periodo = 'all';
let modo = 'compartir';

// ---- Arranque --------------------------------------------------------------

export function initEstadisticas() {
  let btn = null;

  onAuthChange(() => {
    if (!isAdminUser()) { btn?.remove(); btn = null; return; }
    if (btn) return;

    btn = document.createElement('button');
    btn.id = 'btn-stats';
    btn.className = 'btn btn--ghost btn--sm';
    btn.title = 'Estadísticas de los reportes';
    btn.innerHTML = '<i class="ph ph-chart-bar" aria-hidden="true"></i>' +
                    '<span class="hide-mobile">Estadística</span>';
    btn.addEventListener('click', abrir);
    document.querySelector('.topbar__actions')?.appendChild(btn);
  });
}

// ---- Datos -----------------------------------------------------------------

async function cargarReportes() {
  if (!isConfigured) return DEMO_REPORTS;

  const { data, error } = await supabase
    .from('reports_public')
    .select('kind,lifecycle,animal_type,size,event_at,resolved_at,created_at,flags_count')
    .limit(5000);

  if (error) {
    console.error('Estadísticas:', error.message);
    toast('No se pudieron cargar las estadísticas.', 'error');
    return [];
  }
  return data ?? [];
}

// Reparte 100 puntos entre los valores con el método del resto mayor, para que
// los porcentajes que se ven en el pantallazo sumen exactamente 100.
function porcentajes(valores) {
  const total = valores.reduce((a, b) => a + b, 0);
  if (!total) return valores.map(() => 0);
  const exactos = valores.map((v) => (v * 100) / total);
  const base = exactos.map(Math.floor);
  const faltan = 100 - base.reduce((a, b) => a + b, 0);
  const orden = exactos
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto);
  for (let k = 0; k < faltan; k++) base[orden[k % orden.length].i]++;
  return base;
}

function mediana(nums) {
  if (!nums.length) return null;
  const o = [...nums].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

const fechaDe = (r) => new Date(r.created_at ?? r.event_at).getTime();

function calcular(todos, per) {
  const dias = PERIODOS.find((p) => p.valor === per)?.dias;
  const desde = dias ? Date.now() - dias * 86400000 : null;
  const rs = desde ? todos.filter((r) => fechaDe(r) >= desde) : todos;

  const cuenta = (campo, claves) =>
    claves.map((k) => rs.filter((r) => r[campo] === k).length);

  const kinds    = cuenta('kind',        ['perdido', 'encontrado', 'avistado']);
  const animales = cuenta('animal_type', ['perro', 'gato', 'otro']);
  const ciclo    = cuenta('lifecycle',   ['activo', 'resuelto', 'archivado']);
  const tamanos  = cuenta('size',        ['chico', 'mediano', 'grande']);

  // Días entre lo que pasó y el reencuentro. Se descartan los negativos:
  // vienen de fechas mal escritas al publicar, no de reencuentros instantáneos.
  const demoras = rs
    .filter((r) => r.lifecycle === 'resuelto' && r.resolved_at)
    .map((r) => (new Date(r.resolved_at) - new Date(r.event_at)) / 86400000)
    .filter((d) => d >= 0);

  return {
    total: rs.length,
    kinds, animales, ciclo, tamanos,
    resueltos: ciclo[1],
    tasa: rs.length ? (ciclo[1] * 100) / rs.length : 0,
    demoraMediana: mediana(demoras),
    denunciados: rs.filter((r) => (r.flags_count ?? 0) > 0).length,
    ultimos7:  todos.filter((r) => fechaDe(r) >= Date.now() - 7  * 86400000).length,
    ultimos30: todos.filter((r) => fechaDe(r) >= Date.now() - 30 * 86400000).length,
    porMes: ultimosMeses(rs, 6),
  };
}

// Conteo por mes calendario, del más antiguo al más reciente.
function ultimosMeses(rs, cuantos) {
  const hoy = new Date();
  const meses = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({
      label: d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', ''),
      anio: d.getFullYear(),
      valor: rs.filter((r) => {
        const f = new Date(fechaDe(r));
        return f.getFullYear() === d.getFullYear() && f.getMonth() === d.getMonth();
      }).length,
    });
  }
  return meses;
}

// ---- Gráficos (SVG/HTML a mano, sin librerías) -----------------------------

// Anillo de proporciones. La separación entre tramos es un hueco del color del
// fondo (no un borde): así los tramos vecinos se distinguen sin sumar tinta.
function anillo(segmentos, total) {
  const size = 150, r = 55, grosor = 20, c = size / 2;
  const C = 2 * Math.PI * r;
  const HUECO = 5;

  if (!total) {
    return `<svg class="est-donut" viewBox="0 0 ${size} ${size}" role="presentation">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#DCEAF0" stroke-width="${grosor}"/>
    </svg>`;
  }

  const vivos = segmentos.filter((s) => s.valor > 0);
  let acumulado = 0;
  const arcos = vivos.map((s) => {
    const frac = s.valor / total;
    const largo = Math.max(frac * C - (vivos.length > 1 ? HUECO : 0), 1.5);
    const arco = `<circle cx="${c}" cy="${c}" r="${r}" fill="none"
        stroke="${s.color}" stroke-width="${grosor}" stroke-linecap="butt"
        stroke-dasharray="${largo.toFixed(2)} ${(C - largo).toFixed(2)}"
        stroke-dashoffset="${(-acumulado).toFixed(2)}"><title>${escapeHtml(s.label)}</title></circle>`;
    acumulado += frac * C;
    return arco;
  }).join('');

  return `<svg class="est-donut" viewBox="0 0 ${size} ${size}" role="presentation">
    <g transform="rotate(-90 ${c} ${c})">${arcos}</g>
  </svg>`;
}

// Barras horizontales finas. Dos cuidados:
//   · La escala llega hasta 100, no hasta el valor más alto: si un 66% ocupara
//     la pista entera, la barra estaría diciendo "todos" y el número diría otra cosa.
//   · La cifra va SIEMPRE fuera de la barra, así nunca queda un número recortado
//     dentro de un tramo corto.
function barras(filas, sufijo = '%') {
  const tope = sufijo === '%' ? 100 : Math.max(...filas.map((f) => f.valor), 1);
  return `<ul class="est-barras">
    ${filas.map((f) => `
      <li class="est-barra">
        <span class="est-barra__label"><i class="est-punto" style="background:${f.color}"></i>${escapeHtml(f.label)}</span>
        <span class="est-barra__pista">
          <span class="est-barra__fill" style="width:${(f.valor / tope) * 100}%;background:${f.color}"></span>
        </span>
        <span class="est-barra__valor">${f.valor}${sufijo}</span>
      </li>`).join('')}
  </ul>`;
}

// Columnas por mes (una sola serie: un solo color, sin leyenda).
function columnas(meses) {
  const tope = Math.max(...meses.map((m) => m.valor), 1);
  return `<div class="est-cols">
    ${meses.map((m) => `
      <div class="est-col" title="${escapeHtml(m.label)} ${m.anio}: ${m.valor}">
        <span class="est-col__valor">${m.valor}</span>
        <span class="est-col__pista"><span class="est-col__fill" style="height:${(m.valor / tope) * 100}%"></span></span>
        <span class="est-col__label">${escapeHtml(m.label)}</span>
      </div>`).join('')}
  </div>`;
}

function leyenda(filas) {
  return `<ul class="est-leyenda">
    ${filas.map((f) => `
      <li>
        <i class="est-punto" style="background:${f.color}"></i>
        <span class="est-leyenda__txt">${escapeHtml(f.label)}</span>
        <b class="est-leyenda__pct">${f.pct}%</b>
      </li>`).join('')}
  </ul>`;
}

// ---- Vista "Para compartir": tarjeta 4:5 lista para Instagram ---------------

function vistaCompartir(s) {
  if (!s.total) return vacio();

  const pctKind = porcentajes(s.kinds);
  const pctAnim = porcentajes(s.animales);

  const segK = [
    { label: 'Perdidos',     valor: s.kinds[0], color: COLOR_KIND.perdido },
    { label: 'Resguardados', valor: s.kinds[1], color: COLOR_KIND.encontrado },
    { label: 'Avistados',    valor: s.kinds[2], color: COLOR_KIND.avistado },
  ];
  const legK = segK.map((x, i) => ({ ...x, pct: pctKind[i] }));
  const filasA = [
    { label: ANIMAL_META.perro.label + 's', valor: pctAnim[0], color: COLOR_ANIMAL.perro },
    { label: ANIMAL_META.gato.label + 's',  valor: pctAnim[1], color: COLOR_ANIMAL.gato  },
    { label: 'Otros animales',              valor: pctAnim[2], color: COLOR_ANIMAL.otro  },
  ];

  const rango = PERIODOS.find((p) => p.valor === periodo);
  const subtitulo = periodo === 'all'
    ? 'Desde que partimos'
    : `Últimos ${rango.dias} días`;

  // El titular es el dato con el que uno querría abrir la publicación. Mientras
  // no haya ningún reencuentro, un "0%" gigante diría lo contrario de lo que
  // pasa, así que la portada la toma el tipo de reporte más frecuente.
  const mayor = pctKind.indexOf(Math.max(...pctKind));
  const titular = s.resueltos > 0
    ? { valor: Math.round(s.tasa), color: VERDE,
        texto: 'de los reportes terminó con la mascota <b>de vuelta con su familia</b>' }
    : { valor: pctKind[mayor], color: segK[mayor].color,
        texto: `de los reportes son <b>${escapeHtml(segK[mayor].label.toLowerCase())}</b> en la Región de Coquimbo` };

  return `
    <p class="est-hint"><i class="ph ph-camera" aria-hidden="true"></i>
      Sácale un pantallazo a esta tarjeta: ya viene en formato 4:5 para el feed.</p>

    <article class="ig-card" id="ig-card">
      <header class="ig-card__top">
        <span class="ig-card__logo" aria-hidden="true"><i class="ph-fill ph-paw-print"></i></span>
        <span class="ig-card__brand">
          <b>Busca Huellitas</b>
          <small>Región de Coquimbo</small>
        </span>
        <span class="ig-card__handle"><i class="ph-fill ph-instagram-logo" aria-hidden="true"></i> @buscahuellitas</span>
      </header>

      <div class="ig-card__body">
        <p class="ig-card__periodo">${escapeHtml(subtitulo)}</p>

        <div class="ig-hero">
          <span class="ig-hero__valor" style="color:${titular.color}">${titular.valor}%</span>
          <span class="ig-hero__label">${titular.texto}</span>
        </div>

        <div class="ig-grid">
          <figure class="ig-fig">
            <figcaption>Qué reporta la comunidad</figcaption>
            <div class="ig-fig__row">
              <div class="ig-fig__donut">
                ${anillo(segK, s.total)}
                <span class="est-donut__centro" aria-hidden="true"><i class="ph-fill ph-paw-print"></i></span>
              </div>
              ${leyenda(legK)}
            </div>
          </figure>

          <figure class="ig-fig">
            <figcaption>Qué animales buscamos</figcaption>
            ${barras(filasA)}
          </figure>
        </div>
      </div>

      <footer class="ig-card__pie">
        <span>buscahuellitas.cl</span>
        <span class="ig-card__pieig"><i class="ph-fill ph-instagram-logo" aria-hidden="true"></i> @buscahuellitas</span>
      </footer>
    </article>`;
}

// ---- Vista "Interno": números absolutos + tabla -----------------------------

function vistaInterna(s) {
  if (!s.total) return vacio();

  const tile = (label, valor, extra = '') =>
    `<div class="est-tile"><span class="est-tile__label">${escapeHtml(label)}</span>
       <b class="est-tile__valor">${valor}</b>
       ${extra ? `<small class="est-tile__extra">${escapeHtml(extra)}</small>` : ''}</div>`;

  const filas = [
    ['Perdidos',                s.kinds[0]],
    ['Resguardados',            s.kinds[1]],
    ['Avistados',               s.kinds[2]],
    ['— Perros',                s.animales[0]],
    ['— Gatos',                 s.animales[1]],
    ['— Otros animales',        s.animales[2]],
    ['Activos en el mapa',      s.ciclo[0]],
    ['Reunidos con su familia', s.ciclo[1]],
    ['Archivados / ocultos',    s.ciclo[2]],
    ['Tamaño chico',            s.tamanos[0]],
    ['Tamaño mediano',          s.tamanos[1]],
    ['Tamaño grande',           s.tamanos[2]],
    ['Con denuncias',           s.denunciados],
  ];

  return `
    <p class="est-hint est-hint--interna"><i class="ph ph-lock-simple" aria-hidden="true"></i>
      Cifras exactas, sin porcentajes. Esta vista es para ti, no para publicar.</p>

    <div class="est-tiles">
      ${tile('Reportes en el período', s.total)}
      ${tile('Reunidos con su familia', s.resueltos, `${Math.round(s.tasa)}% del total`)}
      ${tile('Activos en el mapa', s.ciclo[0])}
      ${tile('Archivados u ocultos', s.ciclo[2])}
      ${tile('Publicados en 7 días', s.ultimos7, 'sobre todo el histórico')}
      ${tile('Publicados en 30 días', s.ultimos30, 'sobre todo el histórico')}
      ${tile('Días hasta el reencuentro', s.demoraMediana == null ? '—' : Math.round(s.demoraMediana), 'mediana')}
      ${tile('Reportes con denuncias', s.denunciados)}
    </div>

    <figure class="est-bloque">
      <figcaption>Reportes publicados por mes</figcaption>
      ${columnas(s.porMes)}
    </figure>

    <figure class="est-bloque">
      <figcaption>Detalle completo</figcaption>
      <table class="est-tabla">
        <thead><tr><th scope="col">Categoría</th><th scope="col">Reportes</th></tr></thead>
        <tbody>
          ${filas.map(([k, v]) => `<tr><th scope="row">${escapeHtml(k)}</th><td>${v}</td></tr>`).join('')}
        </tbody>
      </table>
    </figure>`;
}

function vacio() {
  return `<div class="est-vacio">
    <i class="ph ph-chart-bar" aria-hidden="true"></i>
    <p>Todavía no hay reportes en este período.</p>
  </div>`;
}

// ---- Panel -----------------------------------------------------------------

async function abrir() {
  reportes = await cargarReportes();
  periodo = 'all';
  modo = 'compartir';

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches est-panel" role="dialog" aria-modal="true" aria-label="Estadísticas">
      <div class="matches__head">
        <h3>Estadísticas</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Solo tú ves esto. Cambia entre la tarjeta para Instagram y el detalle interno.</p>

      <div class="est-controles">
        <div class="est-tabs" role="group" aria-label="Vista">
          <button class="est-tab est-tab--activa" type="button" data-modo="compartir">
            <i class="ph ph-instagram-logo" aria-hidden="true"></i> Para compartir
          </button>
          <button class="est-tab" type="button" data-modo="interno">
            <i class="ph ph-list-numbers" aria-hidden="true"></i> Interno
          </button>
        </div>
        <div class="est-periodos" role="group" aria-label="Período">
          ${PERIODOS.map((p) => `
            <button class="est-periodo${p.valor === 'all' ? ' est-periodo--activo' : ''}"
                    type="button" data-periodo="${p.valor}">${p.label}</button>`).join('')}
        </div>
      </div>

      <div class="est-cuerpo" id="est-cuerpo"></div>
    </div>`;

  document.body.appendChild(overlay);

  const cuerpo = overlay.querySelector('#est-cuerpo');
  const pintar = () => {
    const s = calcular(reportes, periodo);
    cuerpo.innerHTML = modo === 'compartir' ? vistaCompartir(s) : vistaInterna(s);
  };
  pintar();

  // Un solo juego de filtros arriba: manda sobre las dos vistas por igual.
  overlay.querySelectorAll('[data-modo]').forEach((b) => {
    b.addEventListener('click', () => {
      modo = b.dataset.modo;
      overlay.querySelectorAll('[data-modo]').forEach((x) =>
        x.classList.toggle('est-tab--activa', x === b));
      pintar();
    });
  });
  overlay.querySelectorAll('[data-periodo]').forEach((b) => {
    b.addEventListener('click', () => {
      periodo = b.dataset.periodo;
      overlay.querySelectorAll('[data-periodo]').forEach((x) =>
        x.classList.toggle('est-periodo--activo', x === b));
      pintar();
    });
  });

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);
}
