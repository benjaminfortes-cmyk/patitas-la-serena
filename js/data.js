// Capa de datos: consulta de reportes

import { supabase, isConfigured } from './supabase.js';
import { DEMO_REPORTS } from './demo.js';

function corteAntiguedad(age) {
  const h = { '24h': 24, week: 24 * 7, month: 24 * 30 }[age];
  if (!h) return null; // 'all'
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

const VENTANA_RESUELTO_MS = 7 * 24 * 3600 * 1000;
function visibleEnMapa(r) {
  if (r.lifecycle !== 'resuelto') return r.lifecycle !== 'archivado';
  return r.resolved_at && (Date.now() - new Date(r.resolved_at).getTime()) <= VENTANA_RESUELTO_MS;
}

function normalizar(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

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

export async function fetchReports(filtros = {}) {
  const { kinds = [], animals = [], age = 'all', query = '' } = filtros;

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
  return data.filter((r) => visibleEnMapa(r) && coincideTexto(r, query));
}

export async function contarReportesDesde(desde) {
  const corte = new Date(desde).getTime();
  const iso = new Date(corte).toISOString();

  if (!isConfigured) {
    return DEMO_REPORTS.filter((r) =>
      visibleEnMapa(r) && (
        new Date(r.created_at ?? r.event_at).getTime() >= corte ||
        (r.resolved_at && new Date(r.resolved_at).getTime() >= corte)
      )
    ).length;
  }

  const { count, error } = await supabase
    .from('reports_public')
    .select('id', { count: 'exact', head: true })
    .in('lifecycle', ['activo', 'resuelto'])
    .or(`created_at.gte.${iso},resolved_at.gte.${iso}`);

  if (error) { console.error('No se pudieron contar los reportes nuevos:', error.message); return 0; }
  return count ?? 0;
}

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

export async function fetchAvisosPendientes() {
  if (!isConfigured) {
    return DEMO_REPORTS
      .filter((r) => r.resolution_review)
      .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at));
  }
  const { data, error } = await supabase
    .from('reports_public').select('*')
    .eq('resolution_review', true)
    .order('resolved_at', { ascending: false })
    .limit(100);
  if (error) { console.error('No se pudieron cargar los avisos:', error.message); return []; }
  return data;
}

const contactosVistos = new Map();

export async function fetchContacto(report) {
  if (report.contact_whatsapp) return report.contact_whatsapp;
  if (contactosVistos.has(report.id)) return contactosVistos.get(report.id);

  if (!isConfigured) {
    const demo = DEMO_REPORTS.find((r) => r.id === report.id);
    return demo?.contact_whatsapp ?? null;
  }

  // De a uno y nunca en la lista: si el teléfono viniera con los reportes,
  // cualquiera podría bajarse todos los números de una sola consulta.
  const { data, error } = await supabase.rpc('get_report_contact', { p_report_id: report.id });
  if (error) { console.error('No se pudo obtener el contacto:', error.message); return null; }

  contactosVistos.set(report.id, data);
  report.contact_whatsapp = data;   // queda en memoria para el cartel
  return data;
}

export async function fetchReportById(id) {
  if (!isConfigured) {
    return DEMO_REPORTS.find((r) => r.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from('reports_public').select('*').eq('id', id).single();
  if (error) { console.error(error.message); return null; }
  return data;
}
