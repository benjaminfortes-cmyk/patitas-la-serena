// ============================================================================
// Pistas "Yo lo vi": avistamientos que deja la comunidad en un reporte.
//
// Quien vio al animal marca un punto en el mapa y escribe una nota; el dueño ve
// el rastro sin que nadie tenga que dar su teléfono. Leer es público; dejar una
// pista pasa por la función add_sighting() del backend.
// ============================================================================
import { supabase, isConfigured } from './supabase.js';
import { ensureSession } from './auth.js';
import { escapeHtml, toast } from './ui.js';
import { tiempoRelativo } from './constants.js';

// En modo demo (sin backend) las pistas viven en memoria, por reporte.
const DEMO_PISTAS = new Map();

export async function fetchSightings(reportId) {
  if (!isConfigured) {
    return [...(DEMO_PISTAS.get(reportId) ?? [])].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }
  const { data, error } = await supabase
    .from('sightings_public')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });
  if (error) { console.error('Error cargando pistas:', error.message); return []; }
  return data;
}

// Pinta la sección de pistas dentro de la ficha del reporte.
export async function renderPistas(contenedor, report) {
  const pistas = await fetchSightings(report.id);

  const cabecera = `
    <div class="pistas__head">
      <h3 class="pistas__titulo"><i class="ph ph-map-pin-line"></i> ¿Dónde lo han visto?</h3>
      <button class="btn btn--soft btn--sm" data-action="pista"><i class="ph ph-plus"></i> Yo lo vi</button>
    </div>`;

  if (!pistas.length) {
    contenedor.innerHTML = cabecera +
      '<p class="pistas__vacio">Todavía nadie ha dejado una pista. Si lo viste, cuéntanos dónde.</p>';
  } else {
    const items = pistas.map((p) => `
      <li class="pista">
        <span class="pista__ico"><i class="ph-fill ph-map-pin"></i></span>
        <span class="pista__cuerpo">
          ${p.note ? `<span class="pista__nota">${escapeHtml(p.note)}</span>` : '<span class="pista__nota pista__nota--sin">Lo vieron por aquí</span>'}
          <span class="pista__pie">
            <a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener">Ver en mapa</a>
            · ${tiempoRelativo(p.created_at)}
          </span>
        </span>
      </li>`).join('');
    contenedor.innerHTML = cabecera + `<ul class="pistas__lista">${items}</ul>`;
  }

  contenedor.querySelector('[data-action="pista"]')
    ?.addEventListener('click', () => abrirPista(report, contenedor));
}

// Overlay con mini-mapa para marcar el punto y escribir la nota.
async function abrirPista(report, contenedor) {
  await ensureSession();

  const centro = (Number.isFinite(report.lat) && Number.isFinite(report.lng))
    ? [report.lat, report.lng] : [-29.9027, -71.2519];
  const sel = { lat: centro[0], lng: centro[1] };

  const overlay = document.createElement('div');
  overlay.className = 'matches-overlay';
  overlay.innerHTML = `
    <div class="matches" role="dialog" aria-modal="true" aria-label="Dejar una pista">
      <div class="matches__head">
        <h3>¿Dónde lo viste?</h3>
        <button class="sheet__close" data-close aria-label="Cerrar">&times;</button>
      </div>
      <p class="matches__sub">Mueve el punto al lugar donde lo viste y cuéntanos algo (opcional).</p>
      <div id="pista-map" class="form-map"></div>
      <textarea class="input" id="pista-nota" rows="2" maxlength="300"
        placeholder="Ej: lo vi cerca de la plaza, andaba solo y asustado…"></textarea>
      <button class="btn btn--primary" id="pista-enviar" style="width:100%">
        <i class="ph ph-paper-plane-tilt"></i> Enviar pista
      </button>
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('[data-close]').addEventListener('click', cerrar);

  // Mini-mapa centrado en la ubicación del reporte, con un marcador que se arrastra.
  setTimeout(() => {
    const mapa = L.map('pista-map').setView(centro, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    const marcador = L.marker(centro, { draggable: true }).addTo(mapa);
    const fijar = (lat, lng) => { sel.lat = lat; sel.lng = lng; marcador.setLatLng([lat, lng]); };
    marcador.on('dragend', () => { const p = marcador.getLatLng(); fijar(p.lat, p.lng); });
    mapa.on('click', (e) => fijar(e.latlng.lat, e.latlng.lng));
  }, 50);

  overlay.querySelector('#pista-enviar').addEventListener('click', async () => {
    const nota = overlay.querySelector('#pista-nota').value.trim() || null;

    if (isConfigured) {
      const { error } = await supabase.rpc('add_sighting', {
        p_report_id: report.id, p_lat: sel.lat, p_lng: sel.lng, p_note: nota,
      });
      if (error) return toast(error.message, 'error');
    } else {
      const lista = DEMO_PISTAS.get(report.id) ?? [];
      lista.push({ id: crypto.randomUUID(), report_id: report.id, lat: sel.lat, lng: sel.lng, note: nota, created_at: new Date().toISOString() });
      DEMO_PISTAS.set(report.id, lista);
    }

    cerrar();
    toast('¡Gracias! Tu pista puede ayudar a encontrarlo.', 'exito');
    renderPistas(contenedor, report);   // refresca la lista en la ficha
  });
}
