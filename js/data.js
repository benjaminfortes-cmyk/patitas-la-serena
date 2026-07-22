// ============================================================================
// Capa de datos: consulta de reportes
//
// Construye la consulta a Supabase (vista `reports_public`) según los filtros.
// Si no hay backend configurado, devuelve los datos de prueba ya filtrados.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { DEMO_REPORTS } from './demo.js';

// Convierte el filtro de antigüedad en una fecha de corte ISO.
function corteAntiguedad(age) {
  const h = { '24h': 24, week: 24 * 7, month: 24 * 30 }[age];
  if (!h) return null; // 'all'
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

// Los resueltos se muestran en el mapa solo 7 días desde que se resolvieron.
const VENTANA_RESUELTO_MS = 7 * 24 * 3600 * 1000;
function visibleEnMapa(r) {
  if (r.lifecycle !== 'resuelto') return r.lifecycle !== 'archivado';
  return r.resolved_at && (Date.now() - new Date(r.resolved_at).getTime()) <= VENTANA_RESUELTO_MS;
}

// Minúsculas y sin tildes, para que "cafe" encuentre "café" y viceversa.
function normalizar(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Sinónimos de lo que la gente escribe → palabras que sí están en el reporte.
// (el valor guardado es 'chico'/'mediano'/'grande', pero se busca "pequeño")
const SINONIMOS = {
  pequeno: 'chico', pequena: 'chico', peque: 'chico', mini: 'chico',
  pequenito: 'chico', chiquito: 'chico', chica: 'chico',
  medio: 'mediano', mediana: 'mediano',
  grandes: 'grande', grandote: 'grande',
  perra: 'perro', perrito: 'perro', perrita: 'perro', can: 'perro', quiltro: 'perro',
  gata: 'gato', gatito: 'gato', gatita: 'gato', minino: 'gato',
  perdida: 'perdido', perdidos: 'perdido', extraviado: 'perdido', extraviada: 'perdido',
  encontrada: 'encontrado', encontrados: 'encontrado', hallado: 'encontrado',
  avistada: 'avistado', avistamiento: 'avistado', visto: 'avistado',
};

// Búsqueda de texto local sobre todos los campos visibles del reporte:
// nombre, raza, color, descripción, tamaño, tipo de animal y estado.
function coincideTexto(r, q) {
  if (!q) return true;
  const txt = normalizar(
    [r.pet_name, r.breed, r.color, r.description, r.animal_type_other,
     r.size, r.animal_type, r.kind]
      .filter(Boolean).join(' ')
  );
  return normalizar(q).split(/\s+/).filter(Boolean).every((t) => {
    const sin = SINONIMOS[t];
    return txt.includes(t) || (sin && txt.includes(sin));
  });
}

/**
 * Obtiene los reportes a mostrar en el mapa.
 * @param {{kinds:string[], animals:string[], age:string, query:string}} filtros
 */
export async function fetchReports(filtros = {}) {
  const { kinds = [], animals = [], age = 'all', query = '' } = filtros;

  // ---- MODO DEMO (sin backend) -------------------------------------------
  if (!isConfigured) {
    const corte = corteAntiguedad(age);
    return DEMO_REPORTS.filter((r) =>
      visibleEnMapa(r) &&
      (kinds.length === 0 || kinds.includes(r.kind)) &&
      (animals.length === 0 || animals.includes(r.animal_type)) &&
      (!corte || r.event_at >= corte) &&
      coincideTexto(r, query)
    );
  }

  // ---- CONSULTA REAL A SUPABASE ------------------------------------------
  let q = supabase
    .from('reports_public')
    .select('*')
    .in('lifecycle', ['activo', 'resuelto'])   // archivados quedan fuera
    .order('event_at', { ascending: false })
    .limit(500);

  if (kinds.length)   q = q.in('kind', kinds);
  if (animals.length) q = q.in('animal_type', animals);

  const corte = corteAntiguedad(age);
  if (corte) q = q.gte('event_at', corte);

  const { data, error } = await q;
  if (error) {
    console.error('Error cargando reportes:', error.message);
    return [];
  }
  // La búsqueda de texto y la ventana de 7 días para resueltos se aplican en el cliente.
  return data.filter((r) => visibleEnMapa(r) && coincideTexto(r, query));
}

// Trae los últimos reencuentros para la sección "Historias felices".
export async function fetchHappyStories(limite = 20) {
  if (!isConfigured) {
    return DEMO_REPORTS
      .filter((r) => r.lifecycle === 'resuelto')
      .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))
      .slice(0, limite);
  }
  const { data, error } = await supabase
    .from('reports_public').select('*')
    .eq('lifecycle', 'resuelto')
    .order('resolved_at', { ascending: false })
    .limit(limite);
  if (error) { console.error(error.message); return []; }
  return data;
}

// Trae un único reporte por id (para abrir una coincidencia o un enlace compartido).
export async function fetchReportById(id) {
  if (!isConfigured) {
    return DEMO_REPORTS.find((r) => r.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from('reports_public').select('*').eq('id', id).single();
  if (error) { console.error(error.message); return null; }
  return data;
}
