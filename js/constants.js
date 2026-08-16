// Constantes compartidas: tipos de reporte, animales y helpers de formato.

export const KIND_META = {
  perdido:    { label: 'Perdido',                   color: '#EF4444', verbo: 'busca a',
                titular: 'Se busca',     verboCorto: 'lo busca',     icon: 'ph-magnifying-glass' },
  encontrado: { label: 'Rescatado, busca a su familia', color: '#2563EB', verbo: 'rescató a',
                titular: 'Rescatado, busca familia', verboCorto: 'lo rescató', icon: 'ph-house-line' },
  avistado:   { label: 'Avistado',                  color: '#CA8A04', verbo: 'vio a',
                titular: 'Lo vieron',    verboCorto: 'lo vio',       icon: 'ph-eye' },
};

export const ANIMAL_META = {
  perro: { label: 'Perro', icon: 'ph-dog' },
  gato:  { label: 'Gato',  icon: 'ph-cat' },
  otro:  { label: 'Otro',  icon: 'ph-paw-print' },
};

// Logo de cada organización colaboradora. Para agregar una: deja su logo
// cuadrado en assets/img/ y pon acá su org_name en minúsculas y sin tildes.
// Sin logo, su pin usa el sello celeste genérico.
const ORG_LOGOS = {
  'cachupines ucn':          'assets/img/cachupines.png',
  'cachupines':              'assets/img/cachupines.png',
  'fundacion proyecto arca': 'assets/img/proyectoarca.png',
  'proyecto arca':           'assets/img/proyectoarca.png',
  'holos pet':               'assets/img/holospet.png',
  'mascotiendas':            'assets/img/mascotiendas.png',
  'guau que barato':         'assets/img/guauquebarato.png',
  'universidad de la serena':'assets/img/uls.png',
};

export function logoOrganizacion(nombre) {
  if (!nombre) return null;
  const clave = String(nombre)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return ORG_LOGOS[clave] ?? null;
}

export function nombreAnimal(r) {
  if (r.animal_type === 'otro' && r.animal_type_other) return r.animal_type_other;
  return ANIMAL_META[r.animal_type]?.label ?? 'Animal';
}

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

export function fechaPublicacion(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const dias = Math.floor(
    (Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) -
     Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
  );
  if (dias <= 0) return 'Publicado hoy';
  if (dias === 1) return 'Publicado ayer';
  if (dias < 7)  return `Publicado hace ${dias} días`;
  if (dias < 30) {
    const sem = Math.round(dias / 7);
    return `Publicado hace ${sem} ${sem === 1 ? 'semana' : 'semanas'}`;
  }
  const meses = Math.round(dias / 30);
  return `Publicado hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

export function fechaCorta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const texto = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  return d.getFullYear() === new Date().getFullYear()
    ? texto
    : `${texto} ${d.getFullYear()}`;
}

export function tituloReporte(r) {
  if (r.pet_name) return r.pet_name;
  const animal = nombreAnimal(r).toLowerCase();
  return `${animal}${r.color ? ' ' + r.color.toLowerCase() : ''}`;
}
