// Formulario para publicar o editar un reporte.

import { supabase, isConfigured } from './supabase.js';
import { getUser, ensureSession } from './auth.js';
import { comprimirImagen } from './imageCompress.js';
import { subirFoto } from './storage.js';
import { normalizarWhatsapp, formatearWhatsapp } from './validation.js';
import { toast, escapeHtml } from './ui.js';
import { agregarMapaBase } from './basemap.js';
import { flyTo } from './map.js';
import { MAP_CENTER, MAP_ZOOM } from './config.js';
import { DEMO_REPORTS } from './demo.js';
import { fetchContacto } from './data.js';

const estado = { kind: null, animal: null, size: null, lat: null, lng: null, puntoTocado: false, fotoBlob: null, fotoPreview: null };

let formMap, formMarker;
let onPublished = () => {};
let editId = null;   // si está seteado, el formulario está en modo edición

export function initReportForm(cbRecargar) {
  onPublished = cbRecargar;
  window.openReportForm = abrir;   // lo usa el botón flotante (app.js)
  wire();
}

function wire() {
  segmented('kind', (v) => {
    document.getElementById('field-name').hidden = v !== 'perdido';
    aplicarTextos(v);
  });
  segmented('animal', (v) => {
    document.getElementById('animal-other').hidden = v !== 'otro';
  });
  segmented('size');

  document.getElementById('photo').addEventListener('change', onFoto);

  document.getElementById('btn-geoloc').addEventListener('click', usarMiUbicacion);

  const addr = document.getElementById('addr-input');
  addr.addEventListener('input', () => {
    clearTimeout(addrTimer);
    addrTimer = setTimeout(sugerirDirecciones, 300);
  });
  addr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.querySelector('#addr-results .addr__opt')?.click();
    }
    if (e.key === 'Escape') cerrarSugerencias();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.addr') && !e.target.closest('.addr__results')) cerrarSugerencias();
  });

  const desc = document.getElementById('description');
  desc.addEventListener('input', () => {
    document.getElementById('desc-count').textContent = desc.value.length;
  });

  document.getElementById('report-form').addEventListener('input', actualizarRuta);

  document.querySelector('[data-close-form]').addEventListener('click', cerrar);
  document.getElementById('form-backdrop').addEventListener('click', cerrar);

  document.getElementById('report-form').addEventListener('submit', onSubmit);
}

const TEXTOS = {
  perdido: {
    foto:      'Sube una foto de tu mascota',
    breed:     'Raza',
    color:     'Color y señas particulares',
    colorPh:   'Ej: café con pecho blanco, cojea de una pata…',
    fecha:     '¿Cuándo se perdió?',
    donde:     '¿Dónde se perdió?',
    dondeHint: 'Marca el último lugar donde la viste. Busca la dirección, toca el mapa o usa tu ubicación.',
    desc:      'Cuenta lo que ayude a reconocerla: si es asustadiza, si responde a su nombre…',
  },
  encontrado: {
    foto:      'Sube una foto del animal que rescataste',
    breed:     'Raza aproximada (si no sabes, déjalo en blanco)',
    color:     'Color y señas particulares',
    colorPh:   'Ej: negro con las patas blancas, tiene collar rojo…',
    fecha:     '¿Cuándo lo encontraste?',
    donde:     '¿Dónde lo encontraste?',
    dondeHint: 'Marca dónde lo encontraste, no dónde está ahora. Busca la dirección, toca el mapa o usa tu ubicación.',
    desc:      'Cuenta si trae collar o placa, cómo está de salud, si se deja acercar…',
  },
  avistado: {
    foto:      'Sube una foto del animal que viste',
    breed:     'Raza aproximada (si no sabes, déjalo en blanco)',
    color:     'Color y señas que alcanzaste a ver',
    colorPh:   'Ej: café claro, mediano, andaba con collar…',
    fecha:     '¿Cuándo lo viste?',
    donde:     '¿Dónde lo viste?',
    dondeHint: 'Marca el lugar exacto donde lo viste. Busca la dirección, toca el mapa o usa tu ubicación.',
    desc:      'Cuenta hacia dónde iba, si se dejaba acercar, si se veía herido…',
  },
};

const TEXTOS_NEUTROS = {
  foto:      'Toca para tomar una foto o elegirla de tu galería',
  breed:     'Raza aproximada',
  color:     'Color / señas particulares',
  colorPh:   'Ej: café con pecho blanco, cojea de una pata…',
  fecha:     '¿Cuándo fue?',
  donde:     '¿Dónde?',
  dondeHint: 'Busca la dirección, marca el punto en el mapa o usa tu ubicación actual.',
  desc:      'Cuenta detalles que ayuden a identificarla…',
};

function aplicarTextos(kind) {
  const t = TEXTOS[kind] ?? TEXTOS_NEUTROS;
  const poner = (id, prop, valor) => {
    const el = document.getElementById(id);
    if (el) el[prop] = valor;
  };
  poner('photo-hint',  'textContent', t.foto);
  poner('label-breed', 'textContent', t.breed);
  poner('label-color', 'textContent', t.color);
  poner('color',       'placeholder', t.colorPh);
  poner('label-fecha', 'textContent', t.fecha);
  poner('description', 'placeholder', t.desc);
  poner('hint-donde',  'textContent', t.dondeHint);
  poner('legend-donde', 'innerHTML', `${t.donde} <span class="req">*</span>`);
}

function paradaCompleta(parada) {
  switch (parada.dataset.parada) {
    case 'donde': return estado.puntoTocado;
    case 'foto':  return !!estado.fotoBlob || !document.getElementById('photo-preview').hidden;
    default:
      if (parada.querySelector('.seg__btn--active')) return true;
      return [...parada.querySelectorAll('input, textarea')]
        .some((campo) => campo.type !== 'file' && campo.value.trim());
  }
}

function actualizarRuta() {
  const ruta = document.getElementById('ruta');
  const avance = document.getElementById('ruta-avance');
  const meta = ruta?.querySelector('.parada--meta');
  if (!ruta || !avance || !meta) return;

  const visibles = [...ruta.querySelectorAll('[data-parada]')].filter((p) => !p.hidden);

  let finPintado = null;
  let cortado = false;
  visibles.forEach((parada) => {
    const lista = paradaCompleta(parada);
    parada.classList.toggle('parada--lista', lista);
    if (lista && !cortado) finPintado = parada;
    else if (!lista) cortado = true;
  });

  const listoParaPublicar = !!estado.kind && !!estado.animal
    && paradaCompleta(ruta.querySelector('[data-parada="foto"]'))
    && (document.getElementById('field-location').hidden || estado.puntoTocado)
    && !!document.getElementById('whatsapp').value.trim();
  meta.classList.toggle('parada--lista', listoParaPublicar);

  const origen = visibles[0]?.offsetTop ?? 0;
  const hasta = (el) => Math.max(0, el.offsetTop - origen);
  ruta.style.setProperty('--ruta-largo', hasta(meta) + 'px');
  avance.style.height = (listoParaPublicar ? hasta(meta) : finPintado ? hasta(finPintado) : 0) + 'px';
}

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
      actualizarRuta();   // va después de onSet: ahí se muestra u oculta el nombre
    });
  });
}

async function abrir(report) {
  await ensureSession();

  reset();
  editId = report?.id ?? null;
  configurarModo(report);
  if (report) prefill(report);

  document.getElementById('report-modal').classList.add('modal--open');
  document.getElementById('form-backdrop').classList.add('backdrop--show');

  actualizarRuta();

  if (!editId) setTimeout(initFormMap, 50);
}

function configurarModo(report) {
  const editando = !!report;
  document.getElementById('modal-title').textContent = editando ? 'Editar reporte' : 'Publicar un reporte';
  document.getElementById('form-submit').innerHTML = editando
    ? '<i class="ph ph-check"></i> Guardar cambios'
    : '<i class="ph ph-paper-plane-tilt"></i> Publicar reporte';
  document.getElementById('field-location').hidden = editando;
}

function setSeg(group, value) {
  document.querySelectorAll(`[data-seg="${group}"]`).forEach((b) => {
    const activo = b.dataset.value === value;
    b.classList.toggle('seg__btn--active', activo);
    b.setAttribute('aria-pressed', activo);
  });
  estado[group] = value;
}

function prefill(r) {
  setSeg('kind', r.kind);
  aplicarTextos(r.kind);   // setSeg no dispara el callback del selector
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
  fetchContacto(r).then((num) => {
    if (num) document.getElementById('whatsapp').value = formatearWhatsapp(num);
  });

  const dt = new Date(r.event_at);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  document.getElementById('event-at').value = dt.toISOString().slice(0, 16);

  const img = document.getElementById('photo-preview');
  img.src = r.photo_url; img.hidden = false;
  document.getElementById('photo-placeholder').hidden = true;

  estado.lat = r.lat ?? 0;
  estado.lng = r.lng ?? 0;
  estado.puntoTocado = true;   // el reporte ya tiene su punto de antes
}

function cerrar() {
  document.getElementById('report-modal').classList.remove('modal--open');
  document.getElementById('form-backdrop').classList.remove('backdrop--show');
}

function reset() {
  const form = document.getElementById('report-form');
  form.reset();
  Object.assign(estado, { kind: null, animal: null, size: null, lat: null, lng: null, puntoTocado: false, fotoBlob: null, fotoPreview: null });

  document.querySelectorAll('.seg__btn--active').forEach((b) => {
    b.classList.remove('seg__btn--active'); b.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('field-name').hidden = true;
  document.getElementById('animal-other').hidden = true;
  aplicarTextos(null);   // vuelve a los textos neutros
  document.getElementById('photo-preview').hidden = true;
  document.getElementById('photo-placeholder').hidden = false;
  document.getElementById('desc-count').textContent = '0';
  document.getElementById('addr-input').value = '';
  document.getElementById('addr-results').hidden = true;

  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  document.getElementById('event-at').value = ahora.toISOString().slice(0, 16);
}

function initFormMap() {
  if (formMap) { formMap.invalidateSize(); return; }

  formMap = L.map('form-map', { zoomControl: true }).setView(MAP_CENTER, MAP_ZOOM);
  agregarMapaBase(formMap);

  formMarker = L.marker(MAP_CENTER, { draggable: true }).addTo(formMap);
  fijarPunto(MAP_CENTER[0], MAP_CENTER[1], false);   // pin de partida, no elección

  formMarker.on('dragend', () => {
    const { lat, lng } = formMarker.getLatLng();
    fijarPunto(lat, lng);
  });
  formMap.on('click', (e) => {
    formMarker.setLatLng(e.latlng);
    fijarPunto(e.latlng.lat, e.latlng.lng);
  });
}

function fijarPunto(lat, lng, porElUsuario = true) {
  estado.lat = lat;
  estado.lng = lng;
  if (porElUsuario) estado.puntoTocado = true;
  actualizarRuta();   // elegir el punto completa la parada "¿Dónde?"
}

const PHOTON = 'https://photon.komoot.io/api/';
const CAJA_REGION = '-71.85,-32.35,-69.75,-28.95';  // izq,abajo,der,arriba

let addrPeticion;      // aborta la búsqueda anterior si llega otra tecla
let addrTimer;

function etiquetaLugar(p) {
  const titulo = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || 'Sin nombre';
  const partes = [p.district, p.city, p.county].filter(Boolean);
  const detalle = [...new Set(partes)].join(', ');
  return { titulo, detalle };
}

function cerrarSugerencias() {
  const lista = document.getElementById('addr-results');
  lista.hidden = true;
  document.getElementById('addr-input').setAttribute('aria-expanded', 'false');
}

function pintarMensaje(texto) {
  const lista = document.getElementById('addr-results');
  lista.hidden = false;
  lista.innerHTML = `<li class="addr__msg">${texto}</li>`;
}

async function sugerirDirecciones() {
  const input = document.getElementById('addr-input');
  const lista = document.getElementById('addr-results');
  const consulta = input.value.trim();

  if (consulta.length < 3) return cerrarSugerencias();

  addrPeticion?.abort();
  addrPeticion = new AbortController();

  const url = `${PHOTON}?q=${encodeURIComponent(consulta)}`
    + `&limit=8&lang=default&bbox=${CAJA_REGION}`;

  let lugares;
  try {
    const r = await fetch(url, { signal: addrPeticion.signal });
    if (!r.ok) throw new Error();
    lugares = (await r.json()).features ?? [];
  } catch (err) {
    if (err.name === 'AbortError') return;   // llegó otra tecla, no molestamos
    return pintarMensaje('No se pudo buscar. Marca el punto en el mapa.');
  }

  const vistos = new Set();
  const unicos = lugares.filter((f) => {
    const { titulo, detalle } = etiquetaLugar(f.properties);
    const clave = `${titulo}|${detalle}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  }).slice(0, 5);

  if (!unicos.length) {
    return pintarMensaje('Sin resultados. Prueba con menos palabras o marca el punto en el mapa.');
  }

  lista.innerHTML = '';
  unicos.forEach((f) => {
    const { titulo, detalle } = etiquetaLugar(f.properties);
    const [lng, lat] = f.geometry.coordinates;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'addr__opt';
    btn.setAttribute('role', 'option');
    btn.innerHTML = `<i class="ph ph-map-pin" aria-hidden="true"></i>
      <span><b>${escapeHtml(titulo)}</b>${detalle ? `<small>${escapeHtml(detalle)}</small>` : ''}</span>`;
    btn.addEventListener('click', () => elegirLugar(lat, lng, titulo));

    const li = document.createElement('li');
    li.appendChild(btn);
    lista.appendChild(li);
  });

  lista.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function elegirLugar(lat, lng, titulo) {
  formMarker.setLatLng([lat, lng]);
  formMap.setView([lat, lng], 17);
  fijarPunto(lat, lng);
  document.getElementById('addr-input').value = titulo;
  cerrarSugerencias();
  toast('Ubicación marcada. Arrastra el pin si necesitas afinarla.', 'exito');
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

async function onFoto(e) {
  const file = e.target.files[0];
  if (!file) return;

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
    actualizarRuta();
  } catch (err) {
    e.target.value = '';
    toast(err.message, 'error');
  } finally {
    placeholder.innerHTML = textoOriginal;
  }
}

async function onSubmit(e) {
  e.preventDefault();

  if (!estado.kind)   return toast('Elige qué pasó (perdido / encontrado / avistado).', 'error');
  if (!estado.animal) return toast('Elige el tipo de animal.', 'error');
  if (estado.animal === 'otro' && !document.getElementById('animal-other').value.trim())
    return toast('Cuéntanos qué animal es.', 'error');
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
      await guardarEdicion(datos);
      cerrar();
      toast('Cambios guardados.', 'exito');
      onPublished?.();
    } else {
      const nuevo = !isConfigured ? await publicarDemo(datos) : await publicarReal(datos);
      cerrar();
      toast('¡Reporte publicado! Gracias por ayudar.', 'exito');
      window.mostrarVista?.('mapa');
      flyTo(datos.lat, datos.lng, 16);
      onPublished?.();
      window.marcarNovedadesVistas?.();
      window.buscarCoincidencias?.(nuevo);
    }
  } catch (err) {
    toast(err.message || 'No se pudo guardar. Intenta de nuevo.', 'error');
  } finally {
    btn.disabled = false;
    configurarModo(editId ? { id: editId } : null);
  }
}

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

  if (estado.fotoBlob) {
    const { url, path } = await subirFoto(estado.fotoBlob, getUser().id);
    payload.photo_url = url;
    payload.photo_path = path;
  }
  const { error } = await supabase.from('reports').update(payload).eq('id', editId);
  if (error) throw new Error(error.message);
}
