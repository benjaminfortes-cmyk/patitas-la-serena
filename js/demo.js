// ============================================================================
// Datos de prueba (MODO DEMO)
//
// Se usan solo cuando Supabase no está configurado, para poder ver el mapa
// funcionando sin backend. Coordenadas reales repartidas por La Serena.
// ============================================================================

const ahora = Date.now();
const hace = (h) => new Date(ahora - h * 3600 * 1000).toISOString();

// Fotos de ejemplo (Unsplash, libres). En producción vienen de Storage.
const foto = (id) => `https://images.unsplash.com/photo-${id}?w=600&q=70&auto=format`;

export const DEMO_REPORTS = [
  {
    id: 'demo-1', kind: 'perdido', lifecycle: 'activo', animal_type: 'perro',
    pet_name: 'Rocco', breed: 'Quiltro café', color: 'Café con pecho blanco',
    size: 'mediano', event_at: hace(5), lat: -29.9045, lng: -71.2490,
    photo_url: foto('1543466835-00a7907e9de1'), contact_whatsapp: '+56912345678',
    description: 'Se arrancó cerca de la Plaza de Armas. Muy amistoso, responde a su nombre.',
    flags_count: 0, created_at: hace(5),
  },
  {
    id: 'demo-2', kind: 'encontrado', lifecycle: 'activo', animal_type: 'gato',
    pet_name: null, breed: 'Atigrado', color: 'Gris atigrado, ojos verdes',
    size: 'chico', event_at: hace(20), lat: -29.8990, lng: -71.2560,
    photo_url: foto('1574158622682-e40e69881006'), contact_whatsapp: '+56987654321',
    description: 'Apareció en el patio, lo tengo resguardado. Tiene collar rojo sin placa.',
    flags_count: 0, created_at: hace(20),
  },
  {
    id: 'demo-3', kind: 'avistado', lifecycle: 'activo', animal_type: 'perro',
    pet_name: null, breed: 'Pastor alemán', color: 'Negro y fuego',
    size: 'grande', event_at: hace(2), lat: -29.9120, lng: -71.2430,
    photo_url: foto('1589941013453-ec89f33b5e95'), contact_whatsapp: '+56911112222',
    description: 'Lo vi suelto por Av. Francisco de Aguirre, no me dejó acercarme.',
    flags_count: 0, created_at: hace(2),
  },
  {
    id: 'demo-4', kind: 'perdido', lifecycle: 'activo', animal_type: 'gato',
    pet_name: 'Michi', breed: 'Siamés', color: 'Crema con orejas oscuras',
    size: 'chico', event_at: hace(50), lat: -29.8950, lng: -71.2510,
    photo_url: foto('1513360371669-4adf3dd7dff8'), contact_whatsapp: '+56933334444',
    description: 'Salió de casa en La Pampa. Es muy asustadizo.',
    flags_count: 0, created_at: hace(50),
  },
  {
    id: 'demo-5', kind: 'encontrado', lifecycle: 'resuelto', animal_type: 'perro',
    pet_name: null, breed: 'Labrador', color: 'Dorado',
    size: 'grande', event_at: hace(200), lat: -29.9070, lng: -71.2600,
    photo_url: foto('1552053831-71594a27632d'), contact_whatsapp: '+56955556666',
    description: '¡Reunido con su familia! Gracias a todos por compartir.',
    flags_count: 0, resolved_at: hace(30), created_at: hace(200),
  },
  {
    id: 'demo-6', kind: 'avistado', lifecycle: 'activo', animal_type: 'otro',
    animal_type_other: 'Conejo', pet_name: null, breed: 'Doméstico', color: 'Blanco',
    size: 'chico', event_at: hace(8), lat: -29.9015, lng: -71.2455,
    photo_url: foto('1585110396000-c9ffd4e4b308'), contact_whatsapp: '+56977778888',
    description: 'Conejo blanco saltando en un antejardín en el centro.',
    flags_count: 0, created_at: hace(8),
  },
];
