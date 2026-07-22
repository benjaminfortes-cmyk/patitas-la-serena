// ============================================================================
// Constantes compartidas: metadatos de cada tipo de reporte y de animal,
// y pequeños helpers de formato. Lo usan el mapa, los filtros y las fichas.
// ============================================================================

// Los colores acompañan el significado: rojo urgencia, azul a salvo,
// ámbar dato incierto. El verde queda para los reencuentros (--reunidos).
// `titular` es la frase de la franja superior de la ficha: dice de una lo que
// pasa con ese animal, sin que haya que interpretar una etiqueta.
export const KIND_META = {
  perdido:    { label: 'Perdido',                   color: '#EF4444', verbo: 'busca a',
                titular: 'Se busca',     verboCorto: 'lo busca',     icon: 'ph-magnifying-glass' },
  encontrado: { label: 'Resguardado temporalmente', color: '#2563EB', verbo: 'resguardó a',
                titular: 'Está a salvo', verboCorto: 'lo resguarda', icon: 'ph-house-line' },
  avistado:   { label: 'Avistado',                  color: '#CA8A04', verbo: 'vio a',
                titular: 'Lo vieron',    verboCorto: 'lo vio',       icon: 'ph-eye' },
};

// `icon` es el nombre del ícono Phosphor que representa al animal.
export const ANIMAL_META = {
  perro: { label: 'Perro', icon: 'ph-dog' },
  gato:  { label: 'Gato',  icon: 'ph-cat' },
  otro:  { label: 'Otro',  icon: 'ph-paw-print' },
};

export const AGE_OPTIONS = [
  { value: 'all',   label: 'Todo' },
  { value: '24h',   label: 'Últimas 24h' },
  { value: 'week',  label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

// Nombre legible del animal (considera el campo libre "otro").
export function nombreAnimal(r) {
  if (r.animal_type === 'otro' && r.animal_type_other) return r.animal_type_other;
  return ANIMAL_META[r.animal_type]?.label ?? 'Animal';
}

// Fecha relativa amigable: "hace 3 h", "hace 2 días".
export function tiempoRelativo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  const meses = Math.round(d / 30);
  return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

// Fecha exacta y corta: "10 de julio". Acompaña a la relativa, que sirve para
// medir urgencia pero no para recordar "¿fue el día que salí de viaje?".
export function fechaCorta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const texto = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  // Si cruzó de año, el mes solo no basta.
  return d.getFullYear() === new Date().getFullYear()
    ? texto
    : `${texto} ${d.getFullYear()}`;
}

// Título corto para una mascota/reporte (para mensajes y compartir).
export function tituloReporte(r) {
  if (r.pet_name) return r.pet_name;
  const animal = nombreAnimal(r).toLowerCase();
  return `${animal}${r.color ? ' ' + r.color.toLowerCase() : ''}`;
}
