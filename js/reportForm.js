// ============================================================================
// Formulario "Publicar reporte": selección visual, mini-mapa, geolocalización,
// compresión de foto, validación y envío vía la función create_report().
//
// El límite de 3/día y las validaciones viven en la base de datos;
// aquí solo enviamos lat/lng crudos y la base se encarga del resto.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { getUser, ensureSession } from './auth.js';
import { comprimirImagen } from './imageCompress.js';
import { subirFoto } from './storage.js';
import { normalizarWhatsapp, formatearWhatsapp } from './validation.js';
import { toast } from './ui.js';
import { flyTo } from './map.js';
import { MAP_CENTER, MAP_ZOOM } from './config.js';
import { DEMO_REPORTS } from './demo.js';

// Estado del formulario en curso
const estado = { kind: null, animal: null, size: null, lat: null, lng: null, fotoBlob: null, fotoPreview: null };

let formMap, formMarker;
let onPublished = () => {};
let editId = null;   // si está seteado, el formulario está en modo edición

export function initReportForm(cbRecargar) {
  onPublished = cbRecargar;
  window.openReportForm = abrir;   // lo usa el botón flotante (app.js)
  wire();
}

// ---------------------------------------------------------------------------
// Cableado de eventos del formulario
// ---------------------------------------------------------------------------
function wire() {
  // Selectores segmentados (kind / animal / size)
  segmented('kind', (v) => {
    // El nombre de la mascota solo aplica a "perdido"
    document.getElementById('field-name').hidden = v !== 'perdido';
  });
  segmented('animal', (v) => {
    document.getElementById('animal-other').hidden = v !== 'otro';
  });
  segmented('size');

  // Foto
  document.getElementById('photo').addEventListener('change', onFoto);

  // Geolocalización
  document.getElementById('btn-geoloc').addEventListener('click', usarMiUbicacion);

  // Buscador de direcciones
  document.getElementById('btn-addr').addEventListener('click', buscarDireccion);
  document.getElementById('addr-input').addEventListener('keydown', (e) => {
    // Enter dentro del formulario enviaría el reporte: lo usamos para buscar.
    if (e.key === 'Enter') { e.preventDefault(); buscarDireccion(); }
  });

  // Contador de caracteres
  const desc = document.getElementById('description');
  desc.addEventListener('input', () => {
    document.getElementById('desc-count').textContent = desc.value.length;
  });

  // Cerrar
  document.querySelector('[data-close-form]').addEventListener('click', cerrar);
  document.getElementById('form-backdrop').addEventListener('click', cerrar);

  // Enviar
  document.getElementById('report-form').addEventListener('submit', onSubmit);
}

// Helper genérico para botones segmentados (radio visual).
function segmented(group, onSet) {
  document.querySelectorAll(`[data-seg="${group}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`[data-seg="${group}"]`).forEach((b) => {
        b.classList.remove('seg__btn--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('seg__btn--active');
      btn.setAttribute('aria-pressed', 'true');
      estado[group] = btn.dataset.value;
      onSet?.(btn.dataset.value);
    });
  });
}

// ---------------------------------------------------------------------------
// Abrir / cerrar el modal
// ---------------------------------------------------------------------------
async function abrir(report) {
  // Publicar es libre: si todavía no hay sesión, se abre una anónima sin que
  // la persona note nada. La foto obligatoria es el control anti-spam.
  await ensureSession();

  reset();
  // `report` solo llega cuando se abre desde "Editar"; el botón flotante no lo pasa.
  editId = report?.id ?? null;
  configurarModo(report);
  if (report) prefill(report);

  document.getElementById('report-modal').classList.add('modal--open');
  document.getElementById('form-backdrop').classList.add('backdrop--show');

  // El mini-mapa se inicializa la primera vez; si ya existe, solo se refresca.
  if (!editId) setTimeout(initFormMap, 50);
}

// Ajusta títulos y campos según sea creación o edición.
function configurarModo(report) {
  const editando = !!report;
  document.getElementById('modal-title').textContent = editando ? 'Editar reporte' : 'Publicar un reporte';
  document.getElementById('form-submit').innerHTML = editando
    ? '<i class="ph ph-check"></i> Guardar cambios'
    : '<i class="ph ph-paper-plane-tilt"></i> Publicar reporte';
  // En edición la ubicación no se cambia (conserva la ubicación original).
  document.getElementById('field-location').hidden = editando;
}

// Marca un botón segmentado como activo por valor.
function setSeg(group, value) {
  document.querySelectorAll(`[data-seg="${group}"]`).forEach((b) => {
    const activo = b.dataset.value === value;
    b.classList.toggle('seg__btn--active', activo);
    b.setAttribute('aria-pressed', activo);
  });
  estado[group] = value;
}

// Rellena el formulario con un reporte existente (modo edición).
function prefill(r) {
  setSeg('kind', r.kind);
  document.getElementById('field-name').hidden = r.kind !== 'perdido';
  setSeg('animal', r.animal_type);
  const other = document.getElementById('animal-other');
  other.hidden = r.animal_type !== 'otro';
  if (r.animal_type_other) other.value = r.animal_type_other;
  if (r.size) setSeg('size', r.size);
  if (r.pet_name) document.getElementById('pet-name').value = r.pet_name;
  if (r.breed) document.getElementById('breed').value = r.breed;
  if (r.color) document.getElementById('color').value = r.color;
  if (r.description) {
    document.getElementById('description').value = r.description;
    document.getElementById('desc-count').textContent = r.description.length;
  }
  document.getElementById('whatsapp').value = formatearWhatsapp(r.contact_whatsapp);

  const dt = new Date(r.event_at);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  document.getElementById('event-at').value = dt.toISOString().slice(0, 16);

  // Foto existente como vista previa (no es obligatorio reemplazarla)
  const img = document.getElementById('photo-preview');
  img.src = r.photo_url; img.hidden = false;
  document.getElementById('photo-placeholder').hidden = true;

  // La ubicación no se edita, pero seteamos valores para que la validación pase.
  estado.lat = r.lat ?? 0;
  estado.lng = r.lng ?? 0;
}

function cerrar() {
  document.getElementById('report-modal').classList.remove('modal--open');
  document.getElementById('form-backdrop').classList.remove('backdrop--show');
}

function reset() {
  const form = document.getElementById('report-form');
  form.reset();
  Object.assign(estado, { kind: null, animal: null, size: null, lat: null, lng: null, fotoBlob: null, fotoPreview: null });

  // Limpia selecciones visuales
  document.querySelectorAll('.seg__btn--active').forEach((b) => {
    b.classList.remove('seg__btn--active'); b.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('field-name').hidden = true;
  document.getElementById('animal-other').hidden = true;
  document.getElementById('photo-preview').hidden = true;
  document.getElementById('photo-placeholder').hidden = false;
  document.getElementById('desc-count').textContent = '0';
  document.getElementById('addr-input').value = '';
  document.getElementById('addr-results').hidden = true;

  // Fecha por defecto: ahora (en hora local, formato datetime-local)
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  document.getElementById('event-at').value = ahora.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Mini-mapa de ubicación
// ---------------------------------------------------------------------------
function initFormMap() {
  if (formMap) { formMap.invalidateSize(); return; }

  formMap = L.map('form-map', { zoomControl: true }).setView(MAP_CENTER, MAP_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  }).addTo(formMap);

  // Marcador arrastrable que define el punto del reporte
  formMarker = L.marker(MAP_CENTER, { draggable: true }).addTo(formMap);
  fijarPunto(MAP_CENTER[0], MAP_CENTER[1]);

  formMarker.on('dragend', () => {
    const { lat, lng } = formMarker.getLatLng();
    fijarPunto(lat, lng);
  });
  formMap.on('click', (e) => {
    formMarker.setLatLng(e.latlng);
    fijarPunto(e.latlng.lat, e.latlng.lng);
  });
}

function fijarPunto(lat, lng) {
  estado.lat = lat;
  estado.lng = lng;
}

// ---------------------------------------------------------------------------
// Buscador de direcciones (Nominatim de OpenStreetMap)
// ---------------------------------------------------------------------------

// Caja que encierra la Región de Coquimbo: evita que "Balmaceda" caiga en
// Santiago. Formato de Nominatim: izquierda,arriba,derecha,abajo.
const CAJA_REGION = '-71.85,-28.95,-69.75,-32.35';

async function buscarDireccion() {
  const input = document.getElementById('addr-input');
  const lista = document.getElementById('addr-results');
  const consulta = input.value.trim();
  if (!consulta) return;

  lista.hidden = false;
  lista.innerHTML = '<li class="addr__msg">Buscando…</li>';

  const url = 'https://nominatim.openstreetmap.org/search'
    + `?format=json&q=${encodeURIComponent(consulta)}`
    + `&countrycodes=cl&viewbox=${CAJA_REGION}&bounded=1&limit=5&accept-language=es`;

  let resultados;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error();
    resultados = await r.json();
  } catch {
    lista.innerHTML = '<li class="addr__msg">No se pudo buscar. Marca el punto en el mapa.</li>';
    return;
  }

  if (!resultados.length) {
    lista.innerHTML = '<li class="addr__msg">Sin resultados. Prueba con menos palabras (solo la calle o el barrio) o marca el punto en el mapa.</li>';
    return;
  }

  lista.innerHTML = '';
  resultados.forEach((r) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'addr__opt';
    btn.textContent = r.display_name;
    btn.addEventListener('click', () => {
      const lat = Number(r.lat), lng = Number(r.lon);
      formMarker.setLatLng([lat, lng]);
      formMap.setView([lat, lng], 17);
      fijarPunto(lat, lng);
      input.value = r.display_name.split(',').slice(0, 3).join(',');
      lista.hidden = true;
      toast('Ubicación marcada. Ajústala arrastrando el pin si hace falta.', 'exito');
    });
    li.appendChild(btn);
    lista.appendChild(li);
  });
}

function usarMiUbicacion() {
  if (!navigator.geolocation) return toast('Tu navegador no permite geolocalización.', 'error');
  toast('Obteniendo tu ubicación…', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      formMarker.setLatLng([lat, lng]);
      formMap.setView([lat, lng], 16);
      fijarPunto(lat, lng);
    },
    () => toast('No pudimos obtener tu ubicación. Marca el punto en el mapa.', 'error'),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ---------------------------------------------------------------------------
// Foto: validar tamaño, comprimir y previsualizar
// ---------------------------------------------------------------------------
async function onFoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  // El tope se mide sobre el archivo ORIGINAL solo para descartar barbaridades
  // (un video, un RAW enorme) que podrían colgar el navegador al procesarlos.
  // Las fotos normales de celular pesan 4–8 MB y pasan sin problema: la
  // compresión las deja bajo 300 KB antes de subirlas.
  if (file.size > 30 * 1024 * 1024) {
    toast('Ese archivo es demasiado pesado (más de 30 MB).', 'error');
    e.target.value = '';
    return;
  }

  const placeholder = document.getElementById('photo-placeholder');
  const textoOriginal = placeholder.innerHTML;
  placeholder.innerHTML = '<i class="ph ph-spinner"></i><span>Preparando la foto…</span>';

  try {
    estado.fotoBlob = await comprimirImagen(file);
    estado.fotoPreview = URL.createObjectURL(estado.fotoBlob);
    const img = document.getElementById('photo-preview');
    img.src = estado.fotoPreview;
    img.hidden = false;
    placeholder.hidden = true;
  } catch (err) {
    e.target.value = '';
    toast(err.message, 'error');
  } finally {
    // Siempre devolvemos el texto original: si no, al reabrir el formulario
    // el recuadro se quedaría mostrando "Preparando la foto…".
    placeholder.innerHTML = textoOriginal;
  }
}

// ---------------------------------------------------------------------------
// Validación + envío
// ---------------------------------------------------------------------------
async function onSubmit(e) {
  e.preventDefault();

  // Validaciones con mensajes claros
  if (!estado.kind)   return toast('Elige qué pasó (perdido / encontrado / avistado).', 'error');
  if (!estado.animal) return toast('Elige el tipo de animal.', 'error');
  if (estado.animal === 'otro' && !document.getElementById('animal-other').value.trim())
    return toast('Cuéntanos qué animal es.', 'error');
  // En edición la foto y la ubicación ya existen y son opcionales de cambiar.
  if (!editId && !estado.fotoBlob) return toast('La foto es obligatoria.', 'error');
  if (!editId && estado.lat == null) return toast('Marca la ubicación en el mapa.', 'error');

  const whatsapp = normalizarWhatsapp(document.getElementById('whatsapp').value);
  if (!whatsapp) return toast('Revisa el WhatsApp: debe ser +56 9 XXXX XXXX.', 'error');

  const datos = {
    kind: estado.kind,
    animal_type: estado.animal,
    animal_type_other: document.getElementById('animal-other').value.trim() || null,
    pet_name: estado.kind === 'perdido' ? (document.getElementById('pet-name').value.trim() || null) : null,
    breed: document.getElementById('breed').value.trim() || null,
    color: document.getElementById('color').value.trim() || null,
    size: estado.size,
    event_at: new Date(document.getElementById('event-at').value).toISOString(),
    description: document.getElementById('description').value.trim() || null,
    contact_whatsapp: whatsapp,
    lat: estado.lat,
    lng: estado.lng,
  };

  const btn = document.getElementById('form-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner"></i> Guardando…';

  try {
    if (editId) {
      // ---- Edición ----
      await guardarEdicion(datos);
      cerrar();
      toast('Cambios guardados.', 'exito');
      onPublished?.();
    } else {
      // ---- Nuevo reporte ----
      const nuevo = !isConfigured ? await publicarDemo(datos) : await publicarReal(datos);
      cerrar();
      toast('¡Reporte publicado! Gracias por ayudar.', 'exito');
      flyTo(datos.lat, datos.lng, 16);
      onPublished?.();
      // Matching inteligente: busca coincidencias cercanas del tipo opuesto.
      window.buscarCoincidencias?.(nuevo);
    }
  } catch (err) {
    toast(err.message || 'No se pudo guardar. Intenta de nuevo.', 'error');
  } finally {
    btn.disabled = false;
    configurarModo(editId ? { id: editId } : null);
  }
}

// Envío real a Supabase: sube foto y llama a create_report(). Devuelve el reporte.
async function publicarReal(d) {
  const user = await ensureSession();
  if (!user) throw new Error('No se pudo preparar la sesión. Recarga la página.');
  const { url, path } = await subirFoto(estado.fotoBlob, user.id);

  const { data, error } = await supabase.rpc('create_report', {
    p_kind: d.kind,
    p_animal_type: d.animal_type,
    p_lat: d.lat,
    p_lng: d.lng,
    p_photo_url: url,
    p_photo_path: path,
    p_contact_whatsapp: d.contact_whatsapp,
    p_animal_type_other: d.animal_type_other,
    p_pet_name: d.pet_name,
    p_breed: d.breed,
    p_color: d.color,
    p_size: d.size,
    p_event_at: d.event_at,
    p_description: d.description,
  });

  if (error) throw new Error(error.message);
  return { id: data?.id, ...d };
}

// Envío en modo demo: agrega el reporte a la lista en memoria y lo devuelve.
async function publicarDemo(d) {
  const nuevo = {
    id: 'demo-' + crypto.randomUUID(),
    user_id: 'demo-user',           // permite ver los botones de dueño en demo
    lifecycle: 'activo',
    flags_count: 0,
    created_at: new Date().toISOString(),
    photo_url: estado.fotoPreview,
    ...d,
  };
  DEMO_REPORTS.unshift(nuevo);
  return nuevo;
}

// Guarda los cambios de un reporte existente (modo edición).
async function guardarEdicion(d) {
  const payload = {
    kind: d.kind, animal_type: d.animal_type, animal_type_other: d.animal_type_other,
    pet_name: d.pet_name, breed: d.breed, color: d.color, size: d.size,
    event_at: d.event_at, description: d.description, contact_whatsapp: d.contact_whatsapp,
    last_active_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  if (!isConfigured) {
    const r = DEMO_REPORTS.find((x) => x.id === editId);
    if (r) Object.assign(r, payload, estado.fotoBlob ? { photo_url: estado.fotoPreview } : {});
    return;
  }

  // Si eligió una nueva foto, se sube y se actualiza la URL.
  if (estado.fotoBlob) {
    const { url, path } = await subirFoto(estado.fotoBlob, getUser().id);
    payload.photo_url = url;
    payload.photo_path = path;
  }
  // RLS permite el UPDATE solo al dueño del reporte.
  const { error } = await supabase.from('reports').update(payload).eq('id', editId);
  if (error) throw new Error(error.message);
}
