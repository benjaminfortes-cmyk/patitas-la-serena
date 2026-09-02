// Panel de estadísticas — SOLO ADMINISTRADORES
//
// Cinco vistas: la tarjeta para redes y cuatro tableros de análisis
// (Resumen, Reencuentros, Territorio y Comunidad). Todo se calcula en el
// navegador a partir de `reports_public`: no hay tablas ni vistas nuevas.
//
// Paletas: las categóricas y las escalas de un solo tono están validadas
// para daltonismo (ΔE >= 8 entre pares vecinos) y contra el fondo blanco.

import { supabase, isConfigured } from './supabase.js';
import { DEMO_REPORTS } from './demo.js';
import { isAdminUser, onAuthChange } from './auth.js';
import { KIND_META, ANIMAL_META } from './constants.js';
import { escapeHtml, toast } from './ui.js';

const COLOR_KIND = {
  perdido: KIND_META.perdido.color,        // #EF4444
  encontrado: KIND_META.encontrado.color,  // #2563EB
  avistado: KIND_META.avistado.color,      // #CA8A04
};
const COLOR_ANIMAL = { perro: '#1f95b8', gato: '#CA8A04', otro: '#7C3AED' };

const MARCA = '#1f95b8';
const VERDE = '#16A34A';   // reencuentros (var --reunidos)

// Escalas de un solo tono, de claro a oscuro (magnitud, nunca identidad).
const RAMPA3 = ['#5fbad4', '#2b8fae', '#12667f'];
const RAMPA4 = ['#68bed8', '#3a9fc0', '#1c81a1', '#0c5c74'];
const VACIO  = '#EDF6FA';   // celda sin datos en el mapa de calor

const PERIODOS = [
  { valor: 'all',  label: 'Todo' },
  { valor: '365d', label: '12 meses', dias: 365 },
  { valor: '90d',  label: '90 días',  dias: 90 },
  { valor: '30d',  label: '30 días',  dias: 30 },
  { valor: '7d',   label: '7 días',   dias: 7  },
];

const VISTAS = [
  { valor: 'compartir',    label: 'Para compartir', icon: 'ph-instagram-logo' },
  { valor: 'resumen',      label: 'Resumen',        icon: 'ph-squares-four'   },
  { valor: 'reencuentros', label: 'Reencuentros',   icon: 'ph-heart'          },
  { valor: 'territorio',   label: 'Territorio',     icon: 'ph-map-pin'        },
  { valor: 'comunidad',    label: 'Comunidad',      icon: 'ph-users-three'    },
];

// Las 15 comunas de la Región de Coquimbo, con su centro urbano. La comuna de
// cada reporte se deduce por cercanía a estos puntos: es una aproximación, no
// el límite administrativo real (por eso siempre se rotula como "aproximada").
const COMUNAS = [
  { nombre: 'La Serena',    provincia: 'Elqui',  lat: -29.9027, lng: -71.2519 },
  { nombre: 'Coquimbo',     provincia: 'Elqui',  lat: -29.9533, lng: -71.3436 },
  { nombre: 'Andacollo',    provincia: 'Elqui',  lat: -30.2306, lng: -71.0836 },
  { nombre: 'La Higuera',   provincia: 'Elqui',  lat: -29.5083, lng: -71.2683 },
  { nombre: 'Paihuano',     provincia: 'Elqui',  lat: -30.0289, lng: -70.5117 },
  { nombre: 'Vicuña',       provincia: 'Elqui',  lat: -30.0319, lng: -70.7081 },
  { nombre: 'Ovalle',       provincia: 'Limarí', lat: -30.5983, lng: -71.2000 },
  { nombre: 'Combarbalá',   provincia: 'Limarí', lat: -31.1783, lng: -71.0033 },
  { nombre: 'Monte Patria', provincia: 'Limarí', lat: -30.6950, lng: -70.9550 },
  { nombre: 'Punitaqui',    provincia: 'Limarí', lat: -30.8367, lng: -71.2600 },
  { nombre: 'Río Hurtado',  provincia: 'Limarí', lat: -30.2917, lng: -70.7000 },
  { nombre: 'Illapel',      provincia: 'Choapa', lat: -31.6308, lng: -71.1650 },
  { nombre: 'Canela',       provincia: 'Choapa', lat: -31.3944, lng: -71.4569 },
  { nombre: 'Los Vilos',    provincia: 'Choapa', lat: -31.9133, lng: -71.5100 },
  { nombre: 'Salamanca',    provincia: 'Choapa', lat: -31.7783, lng: -70.9639 },
];
const RADIO_COMUNA_KM = 60;   // más lejos que esto: "otro sector"

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FRANJAS = [
  { label: 'Madrugada', corto: '00–06', desde: 0,  hasta: 6  },
  { label: 'Mañana',    corto: '06–12', desde: 6,  hasta: 12 },
  { label: 'Tarde',     corto: '12–18', desde: 12, hasta: 18 },
  { label: 'Noche',     corto: '18–24', desde: 18, hasta: 24 },
];

let reportes = [];
let periodo = 'all';
let vista = 'compartir';

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

async function cargarReportes() {
  if (!isConfigured) return DEMO_REPORTS;

  // Solo columnas cortas: `description` no se pide porque no alimenta ninguna
  // métrica y multiplicaría el peso de la descarga.
  const { data, error } = await supabase
    .from('reports_public')
    .select('kind,lifecycle,animal_type,size,event_at,resolved_at,created_at,' +
            'flags_count,resolution_review,author_org,user_id,photo_url,' +
            'pet_name,breed,color,lat,lng')
    .limit(5000);

  if (error) {
    console.error('Estadísticas:', error.message);
    toast('No se pudieron cargar las estadísticas.', 'error');
    return [];
  }
  return data ?? [];
}

/* =======================================================================
   Cálculo
   ==================================================================== */

const fechaDe = (r) => new Date(r.created_at ?? r.event_at).getTime();
const fmt = (n) => Number(n).toLocaleString('es-CL');
const pct = (parte, total) => (total ? Math.round((parte * 100) / total) : 0);

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

function distanciaKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function comunaDe(r) {
  if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return null;
  let mejor = null;
  let minima = Infinity;
  for (const c of COMUNAS) {
    const d = distanciaKm(r.lat, r.lng, c.lat, c.lng);
    if (d < minima) { minima = d; mejor = c; }
  }
  return minima <= RADIO_COMUNA_KM ? mejor : null;
}

const cuenta = (lista, campo, claves) =>
  claves.map((k) => lista.filter((r) => r[campo] === k).length);

const resueltosDe = (lista) => lista.filter((r) => r.lifecycle === 'resuelto').length;

// Tasa de reencuentro de un subgrupo, con su n: sin el n no se puede avisar
// cuando la muestra es tan chica que el porcentaje no significa nada.
function tasaGrupo(lista, filtro) {
  const grupo = lista.filter(filtro);
  const listos = resueltosDe(grupo);
  return { n: grupo.length, resueltos: listos, tasa: pct(listos, grupo.length) };
}

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

function calcular(todos, per) {
  const dias = PERIODOS.find((p) => p.valor === per)?.dias ?? null;
  const ahora = Date.now();
  const desde = dias ? ahora - dias * 86400000 : null;

  const rs = desde ? todos.filter((r) => fechaDe(r) >= desde) : todos;
  // Ventana inmediatamente anterior, del mismo largo, para las variaciones.
  const previo = dias
    ? todos.filter((r) => fechaDe(r) >= desde - dias * 86400000 && fechaDe(r) < desde)
    : null;

  const kinds    = cuenta(rs, 'kind',        ['perdido', 'encontrado', 'avistado']);
  const animales = cuenta(rs, 'animal_type', ['perro', 'gato', 'otro']);
  const ciclo    = cuenta(rs, 'lifecycle',   ['activo', 'resuelto', 'archivado']);
  const tamanos  = cuenta(rs, 'size',        ['chico', 'mediano', 'grande']);

  const demoras = rs
    .filter((r) => r.lifecycle === 'resuelto' && r.resolved_at && r.event_at)
    .map((r) => (new Date(r.resolved_at) - new Date(r.event_at)) / 86400000)
    .filter((d) => d >= 0 && Number.isFinite(d));

  const cortes = [
    { label: 'Mismo día',    hasta: 1 },
    { label: '1 a 2 días',   hasta: 3 },
    { label: '3 a 7 días',   hasta: 8 },
    { label: '8 a 15 días',  hasta: 16 },
    { label: '16 a 30 días', hasta: 31 },
    { label: 'Más de 30',    hasta: Infinity },
  ];
  const histograma = cortes.map((c, i) => {
    const piso = i ? cortes[i - 1].hasta : 0;
    return { label: c.label, valor: demoras.filter((d) => d >= piso && d < c.hasta).length };
  });

  // Ritmo de publicación: día de la semana × franja horaria.
  const ritmo = DIAS_SEMANA.map(() => FRANJAS.map(() => 0));
  rs.forEach((r) => {
    const f = new Date(fechaDe(r));
    if (Number.isNaN(f.getTime())) return;
    const dia = (f.getDay() + 6) % 7;   // 0 = lunes
    const franja = FRANJAS.findIndex((x) => f.getHours() >= x.desde && f.getHours() < x.hasta);
    if (franja >= 0) ritmo[dia][franja]++;
  });

  // Personas que reportan (las sesiones anónimas también tienen user_id).
  const porPersona = new Map();
  rs.forEach((r) => {
    if (!r.user_id) return;
    porPersona.set(r.user_id, (porPersona.get(r.user_id) ?? 0) + 1);
  });
  const conteos = [...porPersona.values()];
  const personas = conteos.length;
  const repiten = conteos.filter((n) => n > 1).length;

  // Organizaciones aliadas que firman sus reportes.
  const porOrg = new Map();
  rs.forEach((r) => {
    const org = (r.author_org ?? '').trim();
    if (org) porOrg.set(org, (porOrg.get(org) ?? 0) + 1);
  });
  const organizaciones = [...porOrg.entries()]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Territorio.
  const porComuna = new Map();
  let sinUbicacion = 0;
  let fueraDeRango = 0;
  rs.forEach((r) => {
    const c = comunaDe(r);
    if (!c) {
      if (typeof r.lat === 'number' && typeof r.lng === 'number') fueraDeRango++;
      else sinUbicacion++;
      return;
    }
    const acc = porComuna.get(c.nombre) ?? { ...c, valor: 0, resueltos: 0 };
    acc.valor++;
    if (r.lifecycle === 'resuelto') acc.resueltos++;
    porComuna.set(c.nombre, acc);
  });
  const comunas = [...porComuna.values()].sort((a, b) => b.valor - a.valor);
  const provincias = ['Elqui', 'Limarí', 'Choapa'].map((nombre) => ({
    nombre,
    valor: comunas.filter((c) => c.provincia === nombre).reduce((a, c) => a + c.valor, 0),
  }));

  return {
    periodo: per, dias, total: rs.length,
    totalPrevio: previo ? previo.length : null,
    resueltosPrevio: previo ? resueltosDe(previo) : null,
    kinds, animales, ciclo, tamanos,
    resueltos: ciclo[1],
    tasa: pct(ciclo[1], rs.length),
    demoraMediana: mediana(demoras),
    demoraMinima: demoras.length ? Math.min(...demoras) : null,
    reunionesConFecha: demoras.length,
    histograma,
    ritmo, personas, repiten,
    porPersona: personas ? rs.filter((r) => r.user_id).length / personas : 0,
    organizaciones,
    firmados: rs.filter((r) => (r.author_org ?? '').trim()).length,
    comunas, provincias, sinUbicacion, fueraDeRango,
    tasaKind:   ['perdido', 'encontrado', 'avistado'].map((k) => tasaGrupo(rs, (r) => r.kind === k)),
    tasaAnimal: ['perro', 'gato', 'otro'].map((k) => tasaGrupo(rs, (r) => r.animal_type === k)),
    tasaTamano: ['chico', 'mediano', 'grande'].map((k) => tasaGrupo(rs, (r) => r.size === k)),
    calidad: {
      foto:   rs.filter((r) => r.photo_url).length,
      nombre: rs.filter((r) => (r.pet_name ?? '').trim()).length,
      raza:   rs.filter((r) => (r.breed ?? '').trim()).length,
      color:  rs.filter((r) => (r.color ?? '').trim()).length,
    },
    enRevision:  rs.filter((r) => r.resolution_review).length,
    denunciados: rs.filter((r) => (r.flags_count ?? 0) > 0).length,
    frios: rs.filter((r) => r.lifecycle === 'activo' && fechaDe(r) < ahora - 60 * 86400000).length,
    ultimos7:  todos.filter((r) => fechaDe(r) >= ahora - 7  * 86400000).length,
    ultimos30: todos.filter((r) => fechaDe(r) >= ahora - 30 * 86400000).length,
    porMes: ultimosMeses(rs, 12),
  };
}

/* =======================================================================
   Piezas de dibujo
   ==================================================================== */

// Tope del eje Y redondeado a un número limpio y múltiplo de 4, para que las
// tres líneas guía (0, mitad, tope) caigan siempre en enteros.
function escalaTope(max) {
  if (max <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (m * mag >= max) return Math.ceil((m * mag) / 4) * 4;
  }
  return Math.ceil(max / 4) * 4;
}

function seccion(titulo, nota, cuerpo) {
  return `<section class="est-seccion">
    <header class="est-seccion__head">
      <h4>${escapeHtml(titulo)}</h4>
      ${nota ? `<p>${escapeHtml(nota)}</p>` : ''}
    </header>
    ${cuerpo}
  </section>`;
}

// `cuerpo` ya viene armado por otra pieza: no se escapa aquí.
function tarjeta(titulo, nota, cuerpo, mod = '') {
  return `<figure class="est-card${mod ? ' est-card--' + mod : ''}">
    <figcaption class="est-card__head">
      <b>${escapeHtml(titulo)}</b>
      ${nota ? `<small>${escapeHtml(nota)}</small>` : ''}
    </figcaption>
    <div class="est-card__body">${cuerpo}</div>
  </figure>`;
}

// El gemelo en tabla de cada gráfico: ningún valor queda solo en el color.
function detalle(columnas, filas, resumen = 'Ver los números') {
  return `<details class="est-datos">
    <summary>${escapeHtml(resumen)}</summary>
    <table class="est-tabla">
      <thead><tr>${columnas
        .map((c, i) => `<th scope="col"${i ? ' class="est-tabla__num"' : ''}>${escapeHtml(c)}</th>`)
        .join('')}</tr></thead>
      <tbody>${filas.map((f) => `<tr>
        <th scope="row">${escapeHtml(String(f[0]))}</th>
        ${f.slice(1).map((v) => `<td>${escapeHtml(String(v))}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table>
  </details>`;
}

// La cifra con la que abre cada tablero. Una sola por vista.
function hero(valor, texto, color = 'var(--ink)') {
  return `<div class="est-hero">
    <span class="est-hero__valor" style="color:${color}">${escapeHtml(String(valor))}</span>
    <span class="est-hero__txt">${texto}</span>
  </div>`;
}

function delta(actual, anterior, dias) {
  if (anterior == null || !dias) return '';
  if (!anterior) {
    return actual
      ? `<span class="est-delta est-delta--neutro"><i class="ph ph-trend-up" aria-hidden="true"></i> nuevos</span>`
      : '';
  }
  const cambio = Math.round(((actual - anterior) * 100) / anterior);
  const icono = cambio > 0 ? 'ph-trend-up' : cambio < 0 ? 'ph-trend-down' : 'ph-minus';
  const signo = cambio > 0 ? '+' : '';
  return `<span class="est-delta est-delta--neutro">
    <i class="ph ${icono}" aria-hidden="true"></i> ${signo}${cambio}%
    <small>vs. ${dias} días previos</small>
  </span>`;
}

function kpi({ label, valor, nota = '', pie = '', acento = '' }) {
  return `<div class="est-tile">
    <span class="est-tile__label">${escapeHtml(label)}</span>
    <b class="est-tile__valor"${acento ? ` style="color:${acento}"` : ''}>${escapeHtml(String(valor))}</b>
    ${nota ? `<small class="est-tile__extra">${escapeHtml(nota)}</small>` : ''}
    ${pie}
  </div>`;
}

const tiles = (lista) => `<div class="est-tiles">${lista.join('')}</div>`;

function anillo(segmentos, total) {
  const size = 150, r = 55, grosor = 20, c = size / 2;
  const C = 2 * Math.PI * r;
  const HUECO = 5;   // separación en color de fondo entre segmentos

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
        stroke-dashoffset="${(-acumulado).toFixed(2)}"><title>${escapeHtml(s.label)}: ${fmt(s.valor)}</title></circle>`;
    acumulado += frac * C;
    return arco;
  }).join('');

  return `<svg class="est-donut" viewBox="0 0 ${size} ${size}" role="presentation">
    <g transform="rotate(-90 ${c} ${c})">${arcos}</g>
  </svg>`;
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

// Barras horizontales. Cada fila: { label, valor, color, texto?, titulo? }.
function barras(filas, { tope = 100, sufijo = '%' } = {}) {
  const max = tope === 'auto' ? Math.max(...filas.map((f) => f.valor), 1) : tope;
  return `<ul class="est-barras">
    ${filas.map((f) => `
      <li class="est-barra"${f.titulo ? ` title="${escapeHtml(f.titulo)}"` : ''}>
        <span class="est-barra__label"><i class="est-punto" style="background:${f.color}"></i>${escapeHtml(f.label)}</span>
        <span class="est-barra__pista">
          <span class="est-barra__fill" style="width:${Math.min((f.valor / max) * 100, 100)}%;background:${f.color}"></span>
        </span>
        <span class="est-barra__valor">${escapeHtml(f.texto ?? `${fmt(f.valor)}${sufijo}`)}</span>
      </li>`).join('')}
  </ul>`;
}

// Columnas verticales con el valor sobre la tapa.
function columnas(items, color = MARCA) {
  const tope = Math.max(...items.map((m) => m.valor), 1);
  return `<div class="est-cols">
    ${items.map((m) => `
      <div class="est-col" title="${escapeHtml(m.label)}: ${fmt(m.valor)}">
        <span class="est-col__valor">${fmt(m.valor)}</span>
        <span class="est-col__pista">
          <span class="est-col__fill" style="height:${Math.max((m.valor / tope) * 100, m.valor ? 2 : 0)}%;background:${m.color ?? color}"></span>
        </span>
        <span class="est-col__label">${escapeHtml(m.label)}</span>
      </div>`).join('')}
  </div>`;
}

// Serie de tiempo: línea de 2px, relleno al 10% y cursor al pasar el mouse.
function areaTiempo(puntos, color = MARCA) {
  const W = 640, H = 210, PL = 42, PR = 16, PT = 20, PB = 34;
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const n = puntos.length;
  const tope = escalaTope(Math.max(...puntos.map((p) => p.valor), 1));
  const px = (i) => (n === 1 ? PL + iw / 2 : PL + (i * iw) / (n - 1));
  const py = (v) => PT + ih - (v / tope) * ih;
  const base = PT + ih;

  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.valor).toFixed(1)}`).join(' ');
  const area = `${linea} L${px(n - 1).toFixed(1)} ${base} L${px(0).toFixed(1)} ${base} Z`;

  const guias = [0, tope / 2, tope].map((v) => `
    <line class="est-guia" x1="${PL}" y1="${py(v).toFixed(1)}" x2="${W - PR}" y2="${py(v).toFixed(1)}"/>
    <text class="est-eje" x="${PL - 8}" y="${(py(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('');

  const salto = n > 8 ? 2 : 1;
  const ejeX = puntos.map((p, i) => (i % salto || i === n - 1
    ? `<text class="est-eje" x="${px(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${escapeHtml(p.label)}</text>`
    : '')).join('');

  // Etiquetas directas: solo el último punto y el máximo (nunca todos).
  const iMax = puntos.reduce((mejor, p, i) => (p.valor > puntos[mejor].valor ? i : mejor), 0);
  const destacados = [...new Set([iMax, n - 1])].filter((i) => puntos[i].valor > 0);
  const marcas = destacados.map((i) => `
    <circle class="est-punta" cx="${px(i).toFixed(1)}" cy="${py(puntos[i].valor).toFixed(1)}" r="4.5" fill="${color}"/>
    <text class="est-valor" x="${px(i).toFixed(1)}" y="${(py(puntos[i].valor) - 11).toFixed(1)}"
          text-anchor="${i === n - 1 ? 'end' : 'middle'}">${fmt(puntos[i].valor)}</text>`).join('');

  const paso = n > 1 ? iw / (n - 1) : iw;
  const hover = puntos.map((p, i) => `
    <g class="est-hov">
      <rect x="${(px(i) - paso / 2).toFixed(1)}" y="${PT}" width="${paso.toFixed(1)}" height="${ih}" fill="transparent">
        <title>${escapeHtml(p.label)} ${p.anio ?? ''}: ${fmt(p.valor)}</title>
      </rect>
      <g class="est-hov__cap">
        <line x1="${px(i).toFixed(1)}" y1="${PT}" x2="${px(i).toFixed(1)}" y2="${base}" class="est-cursor"/>
        <circle cx="${px(i).toFixed(1)}" cy="${py(p.valor).toFixed(1)}" r="5" fill="${color}" class="est-punta"/>
      </g>
    </g>`).join('');

  return `<svg class="est-serie" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Reportes publicados por mes">
    <defs><linearGradient id="est-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".18"/>
      <stop offset="100%" stop-color="${color}" stop-opacity=".02"/>
    </linearGradient></defs>
    ${guias}
    <path d="${area}" fill="url(#est-grad)"/>
    <path d="${linea}" fill="none" stroke="${color}" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round"/>
    ${marcas}
    ${ejeX}
    ${hover}
  </svg>`;
}

// Medidor: el relleno lleva el estado, la pista es un paso claro del mismo tono.
function medidor(valor, { color = VERDE, pista = '#DCF3E3', etiqueta = '' } = {}) {
  return `<div class="est-medidor">
    <div class="est-medidor__pista" style="background:${pista}">
      <div class="est-medidor__fill" style="width:${Math.min(valor, 100)}%;background:${color}"></div>
    </div>
    ${etiqueta ? `<span class="est-medidor__nota">${escapeHtml(etiqueta)}</span>` : ''}
  </div>`;
}

// Mapa de calor día × franja. Escala de un solo tono con su leyenda.
function mapaCalor(matriz) {
  const max = Math.max(...matriz.flat(), 1);
  const paso = (v) => (v === 0 ? -1 : Math.min(Math.floor((v / max) * RAMPA4.length), RAMPA4.length - 1));

  const celdas = matriz.map((fila, d) => `
    <tr>
      <th scope="row">${DIAS_SEMANA[d]}</th>
      ${fila.map((v, f) => {
        const p = paso(v);
        const fondo = p < 0 ? VACIO : RAMPA4[p];
        const tinta = p >= 2 ? '#fff' : 'var(--ink)';
        return `<td class="est-celda" style="background:${fondo};color:${tinta}"
          title="${DIAS_SEMANA[d]} ${escapeHtml(FRANJAS[f].label)}: ${fmt(v)} reportes">${fmt(v)}</td>`;
      }).join('')}
    </tr>`).join('');

  return `<div class="est-calor">
    <table class="est-calor__tabla">
      <thead><tr><td></td>${FRANJAS.map((f) =>
        `<th scope="col">${escapeHtml(f.label)}<small>${escapeHtml(f.corto)}</small></th>`).join('')}</tr></thead>
      <tbody>${celdas}</tbody>
    </table>
    <div class="est-escala">
      <span>Menos</span>
      ${[VACIO, ...RAMPA4].map((c) => `<i style="background:${c}"></i>`).join('')}
      <span>Más</span>
    </div>
  </div>`;
}

function vacio(texto = 'Todavía no hay reportes en este período.') {
  return `<div class="est-vacio">
    <i class="ph ph-chart-bar" aria-hidden="true"></i>
    <p>${escapeHtml(texto)}</p>
  </div>`;
}

const rangoTxt = (s) =>
  s.periodo === 'all' ? 'desde que partimos' : `en los últimos ${s.dias} días`;

/* =======================================================================
   Vista 1 · Tarjeta para redes sociales
   ==================================================================== */

function vistaCompartir(s) {
  if (!s.total) return vacio();

  const pctKind = porcentajes(s.kinds);
  const pctAnim = porcentajes(s.animales);

  const segK = [
    { label: 'Perdidos', valor: s.kinds[0], color: COLOR_KIND.perdido },
    { label: 'Rescatados, buscan familia', valor: s.kinds[1], color: COLOR_KIND.encontrado },
    { label: 'Avistados', valor: s.kinds[2], color: COLOR_KIND.avistado },
  ];
  const legK = segK.map((x, i) => ({ ...x, pct: pctKind[i] }));
  const filasA = [
    { label: ANIMAL_META.perro.label + 's', valor: pctAnim[0], color: COLOR_ANIMAL.perro },
    { label: ANIMAL_META.gato.label + 's',  valor: pctAnim[1], color: COLOR_ANIMAL.gato  },
    { label: 'Otros animales',              valor: pctAnim[2], color: COLOR_ANIMAL.otro  },
  ];

  const rango = PERIODOS.find((p) => p.valor === periodo);
  const subtitulo = periodo === 'all' ? 'Desde que partimos' : `Últimos ${rango.label}`;

  const mayor = pctKind.indexOf(Math.max(...pctKind));
  const titular = s.resueltos > 0
    ? { valor: s.tasa, color: VERDE,
        texto: 'de los reportes terminó con la mascota <b>de vuelta con su familia</b>' }
    : { valor: pctKind[mayor], color: segK[mayor].color,
        texto: `de los reportes son <b>${escapeHtml(segK[mayor].label.toLowerCase())}</b> en la Región de Coquimbo` };

  return `
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

/* =======================================================================
   Vista 2 · Resumen
   ==================================================================== */

function vistaResumen(s) {
  if (!s.total) return vacio();

  const pctKind = porcentajes(s.kinds);
  const pctAnim = porcentajes(s.animales);

  const segK = [
    { label: 'Perdidos', valor: s.kinds[0], color: COLOR_KIND.perdido },
    { label: 'Rescatados, buscan familia', valor: s.kinds[1], color: COLOR_KIND.encontrado },
    { label: 'Avistados', valor: s.kinds[2], color: COLOR_KIND.avistado },
  ];

  const cabecera = hero(fmt(s.total),
    `reportes publicados <b>${escapeHtml(rangoTxt(s))}</b>`) +
    (s.totalPrevio == null ? '' : `<p class="est-hero__delta">${delta(s.total, s.totalPrevio, s.dias)}</p>`);

  const fila = tiles([
    kpi({ label: 'De vuelta con su familia', valor: fmt(s.resueltos),
          nota: `${s.tasa}% de los reportes del período`, acento: VERDE }),
    kpi({ label: 'Activos en el mapa', valor: fmt(s.ciclo[0]),
          nota: 'esperando una pista ahora mismo' }),
    kpi({ label: 'Publicados en 7 días', valor: fmt(s.ultimos7),
          nota: `${fmt(s.ultimos30)} en los últimos 30 · sobre todo el histórico` }),
    kpi({ label: 'Días hasta el reencuentro',
          valor: s.demoraMediana == null ? '—' : Math.round(s.demoraMediana),
          nota: 'mediana de los casos cerrados' }),
    kpi({ label: 'Necesitan tu revisión', valor: fmt(s.enRevision + s.denunciados),
          nota: `${fmt(s.enRevision)} reencuentros por confirmar · ${fmt(s.denunciados)} con denuncias`,
          acento: s.enRevision + s.denunciados > 0 ? COLOR_KIND.avistado : '' }),
  ]);

  const tendencia = tarjeta(
    'Reportes publicados por mes',
    'Últimos 12 meses del período elegido · el mes en curso va incompleto',
    areaTiempo(s.porMes) +
    detalle(['Mes', 'Reportes'], s.porMes.map((m) => [`${m.label} ${m.anio}`, fmt(m.valor)])),
    'ancha');

  const tipos = tarjeta(
    'Qué reporta la comunidad', 'Reparto de los tres tipos de reporte',
    `<div class="est-donut-row">
      <div class="est-donut-row__fig">
        ${anillo(segK, s.total)}
        <span class="est-donut__centro" aria-hidden="true"><i class="ph-fill ph-paw-print"></i></span>
      </div>
      ${leyenda(segK.map((x, i) => ({ ...x, pct: pctKind[i] })))}
    </div>` +
    detalle(['Tipo', 'Reportes', 'Del total'],
      segK.map((x, i) => [x.label, fmt(x.valor), `${pctKind[i]}%`])));

  const especies = tarjeta(
    'Qué animales buscamos', 'Sobre el total de reportes del período',
    barras([
      { label: 'Perros', valor: pctAnim[0], color: COLOR_ANIMAL.perro, titulo: `${fmt(s.animales[0])} reportes` },
      { label: 'Gatos',  valor: pctAnim[1], color: COLOR_ANIMAL.gato,  titulo: `${fmt(s.animales[1])} reportes` },
      { label: 'Otros animales', valor: pctAnim[2], color: COLOR_ANIMAL.otro, titulo: `${fmt(s.animales[2])} reportes` },
    ]) +
    detalle(['Animal', 'Reportes', 'Del total'], [
      ['Perros', fmt(s.animales[0]), `${pctAnim[0]}%`],
      ['Gatos', fmt(s.animales[1]), `${pctAnim[1]}%`],
      ['Otros animales', fmt(s.animales[2]), `${pctAnim[2]}%`],
    ]));

  const pctCiclo = porcentajes(s.ciclo);
  const estado = tarjeta(
    'En qué terminan los reportes', 'Estado actual de cada publicación',
    barras([
      { label: 'Activos', valor: pctCiclo[0], color: MARCA, titulo: `${fmt(s.ciclo[0])} reportes` },
      { label: 'Reunidos', valor: pctCiclo[1], color: VERDE, titulo: `${fmt(s.ciclo[1])} reportes` },
      { label: 'Archivados', valor: pctCiclo[2], color: '#94A9B1', titulo: `${fmt(s.ciclo[2])} reportes` },
    ]) +
    detalle(['Estado', 'Reportes', 'Del total'], [
      ['Activos en el mapa', fmt(s.ciclo[0]), `${pctCiclo[0]}%`],
      ['De vuelta con su familia', fmt(s.ciclo[1]), `${pctCiclo[1]}%`],
      ['Archivados u ocultos', fmt(s.ciclo[2]), `${pctCiclo[2]}%`],
    ]));

  const pctTam = porcentajes(s.tamanos);
  const tamano = tarjeta(
    'Tamaño de las mascotas', 'De más chico a más grande',
    barras([
      { label: 'Chico', valor: pctTam[0], color: RAMPA3[0], titulo: `${fmt(s.tamanos[0])} reportes` },
      { label: 'Mediano', valor: pctTam[1], color: RAMPA3[1], titulo: `${fmt(s.tamanos[1])} reportes` },
      { label: 'Grande', valor: pctTam[2], color: RAMPA3[2], titulo: `${fmt(s.tamanos[2])} reportes` },
    ]) +
    detalle(['Tamaño', 'Reportes', 'Del total'], [
      ['Chico', fmt(s.tamanos[0]), `${pctTam[0]}%`],
      ['Mediano', fmt(s.tamanos[1]), `${pctTam[1]}%`],
      ['Grande', fmt(s.tamanos[2]), `${pctTam[2]}%`],
    ]));

  return cabecera + fila +
    seccion('Cómo venimos', 'La curva del período completo, mes a mes.', tendencia) +
    seccion('El perfil de los reportes', 'Qué se publica y sobre qué animal.',
      `<div class="est-cards">${tipos}${especies}${estado}${tamano}</div>`);
}

/* =======================================================================
   Vista 3 · Reencuentros
   ==================================================================== */

function vistaReencuentros(s) {
  if (!s.total) return vacio();
  if (!s.resueltos) {
    return vacio('Todavía no hay reencuentros confirmados en este período.');
  }

  // Un porcentaje sobre menos de 10 casos engaña más de lo que informa.
  const MINIMO = 10;
  const conAviso = (g) => (g.n < MINIMO ? `${g.tasa}% · pocos casos` : `${g.tasa}%`);

  const cabecera = hero(`${s.tasa}%`,
    `de los reportes terminó con la mascota <b>de vuelta con su familia</b>`, VERDE) +
    `<div class="est-hero__medidor">${medidor(s.tasa, {
      etiqueta: `${fmt(s.resueltos)} reencuentros sobre ${fmt(s.total)} reportes ${rangoTxt(s)}`,
    })}</div>`;

  const fila = tiles([
    kpi({ label: 'Reencuentros del período', valor: fmt(s.resueltos), acento: VERDE,
          pie: s.resueltosPrevio == null ? '' : delta(s.resueltos, s.resueltosPrevio, s.dias) }),
    kpi({ label: 'Días hasta el reencuentro',
          valor: s.demoraMediana == null ? '—' : Math.round(s.demoraMediana),
          nota: 'mediana: la mitad demora menos que esto' }),
    kpi({ label: 'El más rápido',
          valor: s.demoraMinima == null ? '—' : (s.demoraMinima < 1 ? 'Mismo día' : `${Math.round(s.demoraMinima)} días`),
          nota: 'desde que pasó hasta que volvió' }),
    kpi({ label: 'Siguen esperando', valor: fmt(s.ciclo[0]),
          nota: `${fmt(s.frios)} llevan más de 60 días activos` }),
  ]);

  const porTipo = tarjeta(
    'Qué tipo de reporte se resuelve más', 'Porcentaje de casos cerrados dentro de cada tipo',
    barras([
      { label: 'Perdidos', valor: s.tasaKind[0].tasa, color: COLOR_KIND.perdido,
        texto: conAviso(s.tasaKind[0]), titulo: `${fmt(s.tasaKind[0].resueltos)} de ${fmt(s.tasaKind[0].n)}` },
      { label: 'Rescatados', valor: s.tasaKind[1].tasa, color: COLOR_KIND.encontrado,
        texto: conAviso(s.tasaKind[1]), titulo: `${fmt(s.tasaKind[1].resueltos)} de ${fmt(s.tasaKind[1].n)}` },
      { label: 'Avistados', valor: s.tasaKind[2].tasa, color: COLOR_KIND.avistado,
        texto: conAviso(s.tasaKind[2]), titulo: `${fmt(s.tasaKind[2].resueltos)} de ${fmt(s.tasaKind[2].n)}` },
    ]) +
    detalle(['Tipo', 'Reportes', 'Reunidos', 'Tasa'], [
      ['Perdidos', fmt(s.tasaKind[0].n), fmt(s.tasaKind[0].resueltos), `${s.tasaKind[0].tasa}%`],
      ['Rescatados, buscan familia', fmt(s.tasaKind[1].n), fmt(s.tasaKind[1].resueltos), `${s.tasaKind[1].tasa}%`],
      ['Avistados', fmt(s.tasaKind[2].n), fmt(s.tasaKind[2].resueltos), `${s.tasaKind[2].tasa}%`],
    ]));

  const porAnimal = tarjeta(
    'Qué animal vuelve más a casa', 'Porcentaje de casos cerrados dentro de cada especie',
    barras([
      { label: 'Perros', valor: s.tasaAnimal[0].tasa, color: COLOR_ANIMAL.perro,
        texto: conAviso(s.tasaAnimal[0]), titulo: `${fmt(s.tasaAnimal[0].resueltos)} de ${fmt(s.tasaAnimal[0].n)}` },
      { label: 'Gatos', valor: s.tasaAnimal[1].tasa, color: COLOR_ANIMAL.gato,
        texto: conAviso(s.tasaAnimal[1]), titulo: `${fmt(s.tasaAnimal[1].resueltos)} de ${fmt(s.tasaAnimal[1].n)}` },
      { label: 'Otros', valor: s.tasaAnimal[2].tasa, color: COLOR_ANIMAL.otro,
        texto: conAviso(s.tasaAnimal[2]), titulo: `${fmt(s.tasaAnimal[2].resueltos)} de ${fmt(s.tasaAnimal[2].n)}` },
    ]) +
    detalle(['Animal', 'Reportes', 'Reunidos', 'Tasa'], [
      ['Perros', fmt(s.tasaAnimal[0].n), fmt(s.tasaAnimal[0].resueltos), `${s.tasaAnimal[0].tasa}%`],
      ['Gatos', fmt(s.tasaAnimal[1].n), fmt(s.tasaAnimal[1].resueltos), `${s.tasaAnimal[1].tasa}%`],
      ['Otros animales', fmt(s.tasaAnimal[2].n), fmt(s.tasaAnimal[2].resueltos), `${s.tasaAnimal[2].tasa}%`],
    ]));

  const porTamano = tarjeta(
    'Y según el tamaño', 'Porcentaje de casos cerrados dentro de cada tamaño',
    barras([
      { label: 'Chico', valor: s.tasaTamano[0].tasa, color: RAMPA3[0],
        texto: conAviso(s.tasaTamano[0]), titulo: `${fmt(s.tasaTamano[0].resueltos)} de ${fmt(s.tasaTamano[0].n)}` },
      { label: 'Mediano', valor: s.tasaTamano[1].tasa, color: RAMPA3[1],
        texto: conAviso(s.tasaTamano[1]), titulo: `${fmt(s.tasaTamano[1].resueltos)} de ${fmt(s.tasaTamano[1].n)}` },
      { label: 'Grande', valor: s.tasaTamano[2].tasa, color: RAMPA3[2],
        texto: conAviso(s.tasaTamano[2]), titulo: `${fmt(s.tasaTamano[2].resueltos)} de ${fmt(s.tasaTamano[2].n)}` },
    ]) +
    detalle(['Tamaño', 'Reportes', 'Reunidos', 'Tasa'], [
      ['Chico', fmt(s.tasaTamano[0].n), fmt(s.tasaTamano[0].resueltos), `${s.tasaTamano[0].tasa}%`],
      ['Mediano', fmt(s.tasaTamano[1].n), fmt(s.tasaTamano[1].resueltos), `${s.tasaTamano[1].tasa}%`],
      ['Grande', fmt(s.tasaTamano[2].n), fmt(s.tasaTamano[2].resueltos), `${s.tasaTamano[2].tasa}%`],
    ]));

  const tiempos = tarjeta(
    'Cuánto demora el reencuentro',
    `Desde el día del hecho hasta que se cerró · ${fmt(s.reunionesConFecha)} casos con fecha`,
    columnas(s.histograma, VERDE) +
    detalle(['Demora', 'Reencuentros'], s.histograma.map((h) => [h.label, fmt(h.valor)])),
    'ancha');

  return cabecera + fila +
    seccion('Dónde funciona mejor la red',
      'La tasa se calcula dentro de cada grupo, no sobre el total.',
      `<div class="est-cards">${porTipo}${porAnimal}${porTamano}</div>`) +
    seccion('El tiempo que toma', 'Mientras antes se cierre, más rápido volvió la mascota.', tiempos);
}

/* =======================================================================
   Vista 4 · Territorio
   ==================================================================== */

function vistaTerritorio(s) {
  if (!s.total) return vacio();
  if (!s.comunas.length) {
    return vacio('Ningún reporte del período cae cerca de una comuna de la región.');
  }

  const ubicados = s.comunas.reduce((a, c) => a + c.valor, 0);
  const top = s.comunas.slice(0, 10);
  const maxComuna = top[0].valor;

  const cabecera = hero(fmt(s.comunas.length),
    `comunas de la región con reportes <b>${escapeHtml(rangoTxt(s))}</b>`, MARCA);

  const fila = tiles([
    kpi({ label: 'Comuna con más reportes', valor: s.comunas[0].nombre,
          nota: `${fmt(s.comunas[0].valor)} reportes · ${pct(s.comunas[0].valor, ubicados)}% del total ubicado` }),
    kpi({ label: 'Reportes ubicados', valor: fmt(ubicados),
          nota: `${pct(ubicados, s.total)}% del período` }),
    kpi({ label: 'Fuera de la región', valor: fmt(s.fueraDeRango),
          nota: 'a más de 60 km de un centro comunal' }),
    kpi({ label: 'Sin coordenadas', valor: fmt(s.sinUbicacion),
          nota: 'no se pueden ubicar en el mapa' }),
  ]);

  // Categorías nominales: un solo color para todas las barras.
  const ranking = tarjeta(
    'Dónde se publica más', 'Las 10 comunas con más reportes del período',
    barras(top.map((c) => ({
      label: c.nombre, valor: c.valor, color: MARCA,
      texto: fmt(c.valor), titulo: `${c.provincia} · ${fmt(c.resueltos)} reunidos`,
    })), { tope: maxComuna, sufijo: '' }) +
    detalle(['Comuna', 'Provincia', 'Reportes', 'Reunidos', 'Tasa'],
      s.comunas.map((c) => [c.nombre, c.provincia, fmt(c.valor), fmt(c.resueltos), `${pct(c.resueltos, c.valor)}%`]),
      'Ver las 15 comunas'),
    'ancha');

  const pctProv = porcentajes(s.provincias.map((p) => p.valor));
  const segProv = s.provincias.map((p, i) => ({
    label: p.nombre, valor: p.valor, color: RAMPA3[i], pct: pctProv[i],
  }));
  const provincias = tarjeta(
    'Reparto por provincia', 'Elqui, Limarí y Choapa',
    `<div class="est-donut-row">
      <div class="est-donut-row__fig">
        ${anillo(segProv, ubicados)}
        <span class="est-donut__centro" aria-hidden="true"><i class="ph-fill ph-map-pin"></i></span>
      </div>
      ${leyenda(segProv)}
    </div>` +
    detalle(['Provincia', 'Reportes', 'Del total ubicado'],
      s.provincias.map((p, i) => [p.nombre, fmt(p.valor), `${pctProv[i]}%`])));

  // Solo comunas con muestra suficiente: bajo 10 casos el porcentaje es ruido.
  const conMuestra = s.comunas.filter((c) => c.valor >= 10).slice(0, 8);
  const efectividad = conMuestra.length
    ? tarjeta(
        'Reencuentros por comuna', 'Solo comunas con 10 o más reportes',
        barras(conMuestra.map((c) => ({
          label: c.nombre, valor: pct(c.resueltos, c.valor), color: VERDE,
          texto: `${pct(c.resueltos, c.valor)}%`, titulo: `${fmt(c.resueltos)} de ${fmt(c.valor)}`,
        }))) +
        detalle(['Comuna', 'Reportes', 'Reunidos', 'Tasa'],
          conMuestra.map((c) => [c.nombre, fmt(c.valor), fmt(c.resueltos), `${pct(c.resueltos, c.valor)}%`])))
    : tarjeta('Reencuentros por comuna', 'Solo comunas con 10 o más reportes',
        `<p class="est-nota">Ninguna comuna llega todavía a 10 reportes en este período.</p>`);

  return cabecera + fila +
    seccion('El mapa en números',
      'La comuna se estima por cercanía al centro urbano: es aproximada, no el límite oficial.',
      ranking) +
    seccion('Cobertura de la región', 'Dónde está puesta la red y dónde falta llegar.',
      `<div class="est-cards">${provincias}${efectividad}</div>`);
}

/* =======================================================================
   Vista 5 · Comunidad
   ==================================================================== */

function vistaComunidad(s) {
  if (!s.total) return vacio();

  const cabecera = hero(s.personas ? fmt(s.personas) : '—',
    `personas publicaron reportes <b>${escapeHtml(rangoTxt(s))}</b>`, MARCA);

  const fila = tiles([
    kpi({ label: 'Reportes por persona', valor: s.porPersona ? s.porPersona.toFixed(1) : '—',
          nota: 'promedio del período' }),
    kpi({ label: 'Volvieron a reportar', valor: fmt(s.repiten),
          nota: `${pct(s.repiten, s.personas)}% de quienes publicaron` }),
    kpi({ label: 'Firmados por una organización', valor: fmt(s.firmados),
          nota: `${s.organizaciones.length} organizaciones activas` }),
    kpi({ label: 'Reportes con foto', valor: `${pct(s.calidad.foto, s.total)}%`,
          nota: `${fmt(s.calidad.foto)} de ${fmt(s.total)} reportes` }),
  ]);

  const ritmo = tarjeta(
    'Cuándo publica la comunidad', 'Reportes por día de la semana y franja horaria',
    mapaCalor(s.ritmo) +
    detalle(['Día', ...FRANJAS.map((f) => f.label)],
      s.ritmo.map((f, d) => [DIAS_SEMANA[d], ...f.map(fmt)])),
    'ancha');

  const orgs = s.organizaciones.length
    ? tarjeta(
        'Organizaciones aliadas', 'Reportes firmados por cada organización',
        barras(s.organizaciones.slice(0, 8).map((o) => ({
          label: o.nombre, valor: o.valor, color: MARCA, texto: fmt(o.valor),
        })), { tope: s.organizaciones[0].valor, sufijo: '' }) +
        detalle(['Organización', 'Reportes'],
          s.organizaciones.map((o) => [o.nombre, fmt(o.valor)])))
    : tarjeta('Organizaciones aliadas', 'Reportes firmados por cada organización',
        `<p class="est-nota">Todavía ninguna organización firmó reportes en este período.</p>`);

  const calidad = tarjeta(
    'Qué tan completos llegan', 'Porcentaje de reportes que trae cada dato',
    barras([
      { label: 'Con foto', valor: pct(s.calidad.foto, s.total), color: MARCA, titulo: `${fmt(s.calidad.foto)} reportes` },
      { label: 'Con color', valor: pct(s.calidad.color, s.total), color: MARCA, titulo: `${fmt(s.calidad.color)} reportes` },
      { label: 'Con raza', valor: pct(s.calidad.raza, s.total), color: MARCA, titulo: `${fmt(s.calidad.raza)} reportes` },
      { label: 'Con nombre', valor: pct(s.calidad.nombre, s.total), color: MARCA, titulo: `${fmt(s.calidad.nombre)} reportes` },
    ]) +
    detalle(['Dato', 'Reportes', 'Del total'], [
      ['Con foto', fmt(s.calidad.foto), `${pct(s.calidad.foto, s.total)}%`],
      ['Con color', fmt(s.calidad.color), `${pct(s.calidad.color, s.total)}%`],
      ['Con raza', fmt(s.calidad.raza), `${pct(s.calidad.raza, s.total)}%`],
      ['Con nombre', fmt(s.calidad.nombre), `${pct(s.calidad.nombre, s.total)}%`],
    ]));

  const moderacion = tiles([
    kpi({ label: 'Reencuentros por confirmar', valor: fmt(s.enRevision),
          nota: 'los marcó la comunidad, falta que confirmes',
          acento: s.enRevision > 0 ? COLOR_KIND.avistado : '' }),
    kpi({ label: 'Reportes con denuncias', valor: fmt(s.denunciados),
          nota: 'alguien pidió revisarlos',
          acento: s.denunciados > 0 ? COLOR_KIND.perdido : '' }),
    kpi({ label: 'Archivados u ocultos', valor: fmt(s.ciclo[2]),
          nota: 'ya no aparecen en el mapa' }),
    kpi({ label: 'Casos fríos', valor: fmt(s.frios),
          nota: 'activos hace más de 60 días' }),
  ]);

  return cabecera + fila +
    seccion('El pulso de la comunidad', 'A qué hora conviene publicar y recordar en redes.', ritmo) +
    seccion('Quién sostiene la red', 'Organizaciones aliadas y calidad de lo que llega.',
      `<div class="est-cards">${orgs}${calidad}</div>`) +
    seccion('Tu bandeja de moderación', 'Lo que está esperando una decisión tuya.', moderacion);
}

/* =======================================================================
   Panel
   ==================================================================== */

const PINTORES = {
  compartir: vistaCompartir,
  resumen: vistaResumen,
  reencuentros: vistaReencuentros,
  territorio: vistaTerritorio,
  comunidad: vistaComunidad,
};

async function abrir() {
  reportes = await cargarReportes();
  periodo = 'all';
  vista = 'compartir';

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches est-panel" role="dialog" aria-modal="true" aria-label="Estadísticas">
      <div class="matches__head">
        <h3>Estadísticas</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>

      <div class="est-controles">
        <div class="est-tabs" role="tablist" aria-label="Tablero">
          ${VISTAS.map((v) => `
            <button class="est-tab${v.valor === vista ? ' est-tab--activa' : ''}" type="button"
                    role="tab" aria-selected="${v.valor === vista}" data-vista="${v.valor}">
              <i class="ph ${v.icon}" aria-hidden="true"></i> ${escapeHtml(v.label)}
            </button>`).join('')}
        </div>
        <div class="est-periodos" role="group" aria-label="Período">
          ${PERIODOS.map((p) => `
            <button class="est-periodo${p.valor === periodo ? ' est-periodo--activo' : ''}"
                    type="button" data-periodo="${p.valor}">${escapeHtml(p.label)}</button>`).join('')}
        </div>
      </div>

      <div class="est-cuerpo" id="est-cuerpo"></div>
    </div>`;

  document.body.appendChild(overlay);

  const panel = overlay.querySelector('.est-panel');
  const cuerpo = overlay.querySelector('#est-cuerpo');
  const pintar = () => {
    const s = calcular(reportes, periodo);
    cuerpo.className = `est-cuerpo${vista === 'compartir' ? ' est-cuerpo--card' : ''}`;
    cuerpo.innerHTML = (PINTORES[vista] ?? vistaResumen)(s);
    panel.scrollTop = 0;   // el que scrollea es el panel, no el cuerpo
  };
  pintar();

  overlay.querySelectorAll('[data-vista]').forEach((b) => {
    b.addEventListener('click', () => {
      vista = b.dataset.vista;
      overlay.querySelectorAll('[data-vista]').forEach((x) => {
        const activa = x === b;
        x.classList.toggle('est-tab--activa', activa);
        x.setAttribute('aria-selected', String(activa));
      });
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
