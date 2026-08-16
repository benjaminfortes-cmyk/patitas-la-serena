// Cartel "Se busca" para imprimir o compartir.

import { KIND_META, nombreAnimal, fechaCorta } from './constants.js';
import { toast, escapeHtml } from './ui.js';
import { fetchContacto } from './data.js';

const ANCHO = 1080;
const ALTO = 1350;

const CARTEL = {
  perdido:    { titulo: 'SE BUSCA',          color: '#EF4444' },
  encontrado: { titulo: 'BUSCA A SU FAMILIA', color: '#2563EB' },
  avistado:   { titulo: 'VISTO EN LA CALLE',  color: '#CA8A04' },
};

export function formatearMonto(digitos) {
  return String(digitos).replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatearTelefono(num) {
  if (!num) return '';
  const s = String(num).replace(/[^0-9]/g, '');
  const m = s.match(/^56(9)(\d{4})(\d{4})$/);
  if (m) return `+56 ${m[1]} ${m[2]} ${m[3]}`;
  return num;
}

function cargarImagen(src, conCors = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (conCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cargarFoto(src) {
  if (!src) throw new Error('El reporte no tiene foto');

  try {
    const resp = await fetch(src, { mode: 'cors', cache: 'reload' });
    if (!resp.ok) throw new Error(`respuesta ${resp.status}`);
    const blob = await resp.blob();
    if (typeof createImageBitmap === 'function') return await createImageBitmap(blob);
    const url = URL.createObjectURL(blob);
    const img = await cargarImagen(url);
    URL.revokeObjectURL(url);
    return img;
  } catch {
    const sep = src.includes('?') ? '&' : '?';
    return cargarImagen(`${src}${sep}cartel=1`, true);
  }
}

const fotosCargadas = new Map();

function cargarFotoCacheada(src) {
  if (!fotosCargadas.has(src)) {
    if (fotosCargadas.size >= 3) fotosCargadas.delete(fotosCargadas.keys().next().value);
    fotosCargadas.set(src, cargarFoto(src).catch((err) => {
      fotosCargadas.delete(src);
      throw err;
    }));
  }
  return fotosCargadas.get(src);
}

function dibujarPatita(ctx, x, y, tam, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tam / 512, tam / 512);
  ctx.fillStyle = color;
  [[168, 206, 42], [232, 168, 46], [300, 168, 46], [356, 214, 42]].forEach(([cx, cy, r]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fill(new Path2D('M262 250c-72 0-118 52-118 112 0 48 38 74 118 74s118-26 118-74c0-60-46-112-118-112z'));
  ctx.restore();
}

const TRAZO_WHATSAPP = new Path2D('M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z');

function dibujarWhatsapp(ctx, x, y, tam, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tam / 24, tam / 24);
  ctx.fillStyle = color;
  ctx.fill(TRAZO_WHATSAPP);
  ctx.restore();
}

function dibujarInstagram(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.1;
  panelRedondeado(ctx, x, y, s, s, s * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, s * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s * 0.76, y + s * 0.24, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function panelRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const ZOOM_MAX = 3;   // hasta 3 veces más cerca; alejar llega hasta ver la foto entera

function rellenarBorroso(ctx, img, x, y, w, h) {
  const escala = Math.max(w / img.width, h / img.height) * 1.2;
  const nw = img.width * escala;
  const nh = img.height * escala;
  ctx.save();
  ctx.filter = 'blur(30px)';   // si el navegador no lo soporta, queda la foto ampliada de fondo
  ctx.drawImage(img, x + (w - nw) / 2, y + (h - nh) / 2, nw, nh);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fillRect(x, y, w, h);
}

function dibujarFotoCover(ctx, img, x, y, w, h, foco = { x: .5, y: .5 }, zoom = 1) {
  const cubrir = Math.max(w / img.width, h / img.height);   // llena el marco (recorta)
  const entera = Math.min(w / img.width, h / img.height);   // cabe completa (deja aire)
  const zoomMin = entera / cubrir;
  const escala = cubrir * Math.min(ZOOM_MAX, Math.max(zoomMin, zoom));
  const nw = img.width * escala;
  const nh = img.height * escala;
  const nx = x + (nw > w ? (w - nw) * foco.x : (w - nw) / 2);
  const ny = y + (nh > h ? (h - nh) * foco.y : (h - nh) / 2);
  ctx.save();
  panelRedondeado(ctx, x, y, w, h, 24);
  ctx.clip();
  if (nw < w - 1 || nh < h - 1) rellenarBorroso(ctx, img, x, y, w, h);
  ctx.drawImage(img, nx, ny, nw, nh);
  ctx.restore();
  return { moverX: nw - w > 2, moverY: nh - h > 2, zoomMin, zoomMax: ZOOM_MAX };
}

function envolverTexto(ctx, texto, maxAncho, maxLineas) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';

  for (let i = 0; i < palabras.length; i++) {
    const prueba = actual ? `${actual} ${palabras[i]}` : palabras[i];
    if (ctx.measureText(prueba).width <= maxAncho || !actual) {
      actual = prueba;
      continue;
    }
    lineas.push(actual);
    actual = palabras[i];
    if (lineas.length === maxLineas - 1) {
      actual = palabras.slice(i).join(' ');
      break;
    }
  }
  lineas.push(actual);

  const ultima = lineas.length - 1;
  if (ctx.measureText(lineas[ultima]).width > maxAncho) {
    let t = lineas[ultima];
    while (t && ctx.measureText(t + '…').width > maxAncho) t = t.slice(0, -1);
    lineas[ultima] = t.replace(/\s+\S*$/, '') + '…';
  }
  return lineas.slice(0, maxLineas);
}

function textoQueEntra(ctx, texto, maxAncho, tamInicial, fuente) {
  let tam = tamInicial;
  do {
    ctx.font = `800 ${tam}px ${fuente}`;
    if (ctx.measureText(texto).width <= maxAncho) break;
    tam -= 4;
  } while (tam > 28);
  return tam;
}

export async function construirCartel(report, opciones = {}) {
  const {
    foco = { x: .5, y: .5 },
    zoom = 1,
    verSenas = true,
    verDescripcion = true,
    recompensa = '',
  } = opciones;
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  const FUENTE = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

  const meta = CARTEL[report.kind] ?? CARTEL.perdido;
  const resuelto = report.lifecycle === 'resuelto';
  const acento = resuelto ? '#16A34A' : meta.color;
  const titular = resuelto ? 'VOLVIÓ A CASA' : meta.titulo;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f95b8';
  ctx.fillRect(0, 0, ANCHO, 94);

  ctx.fillStyle = 'rgba(255,255,255,.20)';
  panelRedondeado(ctx, 40, 17, 60, 60, 17);
  ctx.fill();
  dibujarPatita(ctx, 48, 23, 44, '#ffffff');

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 33px ${FUENTE}`;
  ctx.fillText('Busca Huellitas', 116, 39);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = `700 19px ${FUENTE}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  ctx.fillText('REGIÓN DE COQUIMBO', 116, 68);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  ctx.font = `700 22px ${FUENTE}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText('@buscahuellitas', ANCHO - 40, 48);
  const anchoArroba = ctx.measureText('@buscahuellitas').width;
  ctx.textAlign = 'left';
  dibujarInstagram(ctx, ANCHO - 40 - anchoArroba - 36, 36, 24, '#ffffff');

  ctx.fillStyle = acento;
  ctx.fillRect(0, 94, ANCHO, 90);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `800 56px ${FUENTE}`;
  ctx.fillText(titular, ANCHO / 2, 140);
  ctx.textAlign = 'left';

  const CAJA_ALTO = 104;
  const PIE_ALTO = 58;                             // franja de buscahuellitas.cl
  const cajaY = ALTO - PIE_ALTO - 24 - CAJA_ALTO;  // caja de WhatsApp, sobre el pie
  const fotoY = 202;

  const senas = verSenas && report.color ? `Señas: ${report.color}` : '';
  ctx.font = `600 27px ${FUENTE}`;
  const lineasSenas = senas ? envolverTexto(ctx, senas, ANCHO - 120, 2) : [];

  ctx.font = `italic 600 28px ${FUENTE}`;
  const lineasDesc = verDescripcion && report.description
    ? envolverTexto(ctx, `“${report.description}”`, ANCHO - 140, 3)
    : [];

  const montoRecompensa = String(recompensa || '').replace(/[^0-9]/g, '');
  const RECOMPENSA_ALTO = montoRecompensa ? 100 : 0;   // franja + su aire

  const altoTexto = 66                                          // nombre
    + 48                                                        // línea de datos
    + (lineasSenas.length ? 44 + (lineasSenas.length - 1) * 36 : 0)
    + (lineasDesc.length ? 48 + (lineasDesc.length - 1) * 36 : 0)
    + 30;                                                       // aire antes de la caja

  const espacioFoto = cajaY - RECOMPENSA_ALTO - fotoY - altoTexto;
  const fotoAlto = Math.max(420, Math.min(espacioFoto, 820));

  try {
    const foto = await cargarFotoCacheada(report.photo_url);
    canvas.encuadre = dibujarFotoCover(ctx, foto, 40, fotoY, ANCHO - 80, fotoAlto, foco, zoom);
  } catch {
    canvas.encuadre = { moverX: false, moverY: false, zoomMin: 1, zoomMax: 1 };
    ctx.fillStyle = '#eef3f5';
    panelRedondeado(ctx, 40, fotoY, ANCHO - 80, fotoAlto, 24);
    ctx.fill();
    ctx.fillStyle = '#9fb3ba';
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FUENTE}`;
    ctx.fillText('Foto no disponible', ANCHO / 2, fotoY + fotoAlto / 2);
    ctx.textAlign = 'left';
  }

  let y = fotoY + fotoAlto + 66;
  const nombre = report.pet_name || nombreAnimal(report);
  ctx.fillStyle = '#12303a';
  ctx.textAlign = 'center';
  const tamNombre = textoQueEntra(ctx, nombre, ANCHO - 120, 68, FUENTE);
  ctx.font = `800 ${tamNombre}px ${FUENTE}`;
  ctx.fillText(nombre, ANCHO / 2, y);

  const SIZE = { chico: 'chico', mediano: 'mediano', grande: 'grande' };
  const datos = [
    nombreAnimal(report),
    report.breed,
    SIZE[report.size],
    report.kind === 'perdido' ? `se perdió el ${fechaCorta(report.event_at)}` : `visto el ${fechaCorta(report.event_at)}`,
  ].filter(Boolean).join('  ·  ');
  y += 48;
  ctx.fillStyle = '#5b7078';
  ctx.font = `600 29px ${FUENTE}`;
  ctx.fillText(datos, ANCHO / 2, y);

  if (lineasSenas.length) {
    y += 44;
    ctx.font = `600 27px ${FUENTE}`;
    ctx.fillStyle = '#5b7078';
    lineasSenas.forEach((linea, i) => ctx.fillText(linea, ANCHO / 2, y + i * 36));
    y += (lineasSenas.length - 1) * 36;
  }

  if (lineasDesc.length) {
    y += 48;
    ctx.font = `italic 600 28px ${FUENTE}`;
    ctx.fillStyle = '#3d5a64';
    lineasDesc.forEach((linea, i) => ctx.fillText(linea, ANCHO / 2, y + i * 36));
  }

  if (montoRecompensa) {
    const franjaAlto = 78;
    const franjaY = cajaY - 22 - franjaAlto;
    ctx.fillStyle = '#F5B700';
    panelRedondeado(ctx, 40, franjaY, ANCHO - 80, franjaAlto, 18);
    ctx.fill();
    ctx.fillStyle = '#3d2a00';
    ctx.textAlign = 'center';
    ctx.font = `800 42px ${FUENTE}`;
    ctx.fillText(`RECOMPENSA $${formatearMonto(montoRecompensa)}`, ANCHO / 2, franjaY + franjaAlto / 2 + 1);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#25D366';
  panelRedondeado(ctx, 40, cajaY, ANCHO - 80, CAJA_ALTO, 20);
  ctx.fill();

  const telefono = formatearTelefono(report.contact_whatsapp);
  ctx.font = `800 56px ${FUENTE}`;
  const anchoTel = ctx.measureText(telefono).width;
  const LOGO = 62;
  const inicio = (ANCHO - (LOGO + 26 + anchoTel)) / 2;
  dibujarWhatsapp(ctx, inicio, cajaY + (CAJA_ALTO - LOGO) / 2, LOGO, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(telefono, inicio + LOGO + 26, cajaY + CAJA_ALTO / 2 + 2);

  ctx.fillStyle = '#1f95b8';
  ctx.fillRect(0, ALTO - PIE_ALTO, ANCHO, PIE_ALTO);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `700 22px ${FUENTE}`;
  ctx.fillText('No olvides buscar en buscahuellitas.cl', ANCHO / 2, ALTO - PIE_ALTO / 2);
  ctx.textAlign = 'left';

  return canvas;
}

function guardarCartel(url, nombreArchivo) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Cartel guardado en tus descargas.', 'exito');
}

const PASO_ENCUADRE = 0.1;   // cuánto se corre la foto en cada toque
const PASO_ZOOM = 1.2;       // cuánto se acerca o aleja en cada toque

function abrirVentanaCartel({ report, canvas, nombreArchivo, titulo, textoCompartir }) {
  const opciones = { foco: { x: .5, y: .5 }, zoom: 1, verSenas: true, verDescripcion: true, recompensa: '' };
  let url = '';
  let archivo = null;
  let limites = { zoomMin: 1, zoomMax: ZOOM_MAX };

  const capa = document.createElement('div');
  capa.className = 'cartel';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', titulo);
  capa.innerHTML = `
    <button class="cartel__cerrar" type="button" aria-label="Cerrar">&times;</button>
    <div class="cartel__caja">
      <img class="cartel__img" alt="${escapeHtml(titulo)}" />

      <div class="cartel__mover">
        <span class="cartel__mover-titulo">¿La foto salió corrida? Muévela o acércala</span>
        <div class="cartel__flechas">
          <button type="button" data-mover="arriba" aria-label="Subir la foto"><i class="ph ph-arrow-up"></i></button>
          <button type="button" data-mover="abajo" aria-label="Bajar la foto"><i class="ph ph-arrow-down"></i></button>
          <button type="button" data-mover="izquierda" aria-label="Correr la foto a la izquierda"><i class="ph ph-arrow-left"></i></button>
          <button type="button" data-mover="derecha" aria-label="Correr la foto a la derecha"><i class="ph ph-arrow-right"></i></button>
          <button type="button" data-mover="alejar" aria-label="Alejar la foto"><i class="ph ph-magnifying-glass-minus"></i></button>
          <button type="button" data-mover="acercar" aria-label="Acercar la foto"><i class="ph ph-magnifying-glass-plus"></i></button>
          <button type="button" data-mover="centrar" class="cartel__centrar"
                  aria-label="Volver la foto al encuadre original">Centrar</button>
        </div>
      </div>

      <div class="cartel__mover">
        <span class="cartel__mover-titulo">Qué mostrar en el cartel</span>
        <div class="cartel__chips">
          ${report.color ? `
          <button type="button" class="cartel__chip is-on" data-ver="verSenas">
            <i class="ph ph-check"></i> Señas</button>` : ''}
          ${report.description ? `
          <button type="button" class="cartel__chip is-on" data-ver="verDescripcion">
            <i class="ph ph-check"></i> Descripción</button>` : ''}
          <button type="button" class="cartel__chip" data-ver="recompensa">
            <i class="ph ph-check"></i> Recompensa</button>
        </div>
        <label class="cartel__monto" hidden>
          <span>$</span>
          <input type="text" inputmode="numeric" autocomplete="off"
                 placeholder="50.000" aria-label="Monto de la recompensa en pesos" />
        </label>
      </div>

      <div class="cartel__botones">
        <button class="btn btn--primary" type="button" data-cartel="guardar">
          <i class="ph ph-download-simple"></i> Guardar en mi celular
        </button>
        <button class="btn btn--soft" type="button" data-cartel="compartir" hidden>
          <i class="ph ph-share-network"></i> Compartir
        </button>
      </div>

      <p class="cartel__ayuda">
        En iPhone usa <b>Compartir → Guardar imagen</b> para que quede en tus fotos.
      </p>
    </div>`;

  const img = capa.querySelector('.cartel__img');
  const btnCompartir = capa.querySelector('[data-cartel="compartir"]');
  const flechas = capa.querySelectorAll('[data-mover]');

  async function mostrar(cv) {
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png', 0.92));
    if (!blob) return toast('No se pudo crear el cartel.', 'error');

    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    img.src = url;
    archivo = new File([blob], nombreArchivo, { type: 'image/png' });
    btnCompartir.hidden = !(navigator.canShare && navigator.canShare({ files: [archivo] }));

    const { moverX = false, moverY = false, zoomMin = 1, zoomMax = ZOOM_MAX } = cv.encuadre ?? {};
    limites = { zoomMin, zoomMax };
    opciones.zoom = Math.min(zoomMax, Math.max(zoomMin, opciones.zoom));
    flechas.forEach((b) => {
      const eje = b.dataset.mover;
      if (eje === 'centrar') b.disabled = !(moverX || moverY || opciones.zoom !== 1);
      else if (eje === 'acercar') b.disabled = opciones.zoom >= zoomMax - .001;
      else if (eje === 'alejar') b.disabled = opciones.zoom <= zoomMin + .001;
      else if (eje === 'arriba' || eje === 'abajo') b.disabled = !moverY;
      else b.disabled = !moverX;
    });
  }

  let dibujando = false;
  let pendiente = false;
  async function redibujar() {
    if (dibujando) { pendiente = true; return; }
    dibujando = true;
    await mostrar(await construirCartel(report, opciones));
    dibujando = false;
    if (pendiente) { pendiente = false; redibujar(); }
  }

  function mover(hacia) {
    const foco = opciones.foco;
    const tope = (v) => Math.min(1, Math.max(0, v));
    if (hacia === 'arriba')     foco.y = tope(foco.y + PASO_ENCUADRE);
    if (hacia === 'abajo')      foco.y = tope(foco.y - PASO_ENCUADRE);
    if (hacia === 'izquierda')  foco.x = tope(foco.x + PASO_ENCUADRE);
    if (hacia === 'derecha')    foco.x = tope(foco.x - PASO_ENCUADRE);
    if (hacia === 'alejar')     opciones.zoom = Math.max(limites.zoomMin, opciones.zoom / PASO_ZOOM);
    if (hacia === 'acercar')    opciones.zoom = Math.min(limites.zoomMax, opciones.zoom * PASO_ZOOM);
    if (hacia === 'centrar')  { foco.x = .5; foco.y = .5; opciones.zoom = 1; }
    redibujar();
  }

  const cerrar = () => {
    document.removeEventListener('keydown', alTeclear, true);
    clearTimeout(esperando);
    if (url) URL.revokeObjectURL(url);
    capa.remove();
  };
  function alTeclear(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    cerrar();
  }

  capa.addEventListener('click', (e) => {
    if (e.target === capa || e.target.closest('.cartel__cerrar')) cerrar();
  });

  flechas.forEach((b) => b.addEventListener('click', () => mover(b.dataset.mover)));

  const campoMonto = capa.querySelector('.cartel__monto');
  const inputMonto = campoMonto.querySelector('input');

  capa.querySelectorAll('[data-ver]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const encendido = chip.classList.toggle('is-on');
      if (chip.dataset.ver === 'recompensa') {
        campoMonto.hidden = !encendido;
        opciones.recompensa = encendido ? inputMonto.value : '';
        if (encendido) inputMonto.focus();
      } else {
        opciones[chip.dataset.ver] = encendido;
      }
      redibujar();
    });
  });

  let esperando;
  inputMonto.addEventListener('input', () => {
    inputMonto.value = formatearMonto(inputMonto.value);
    opciones.recompensa = inputMonto.value;
    clearTimeout(esperando);
    esperando = setTimeout(redibujar, 350);
  });

  capa.querySelector('[data-cartel="guardar"]').addEventListener('click', () => {
    guardarCartel(url, nombreArchivo);
  });

  btnCompartir.addEventListener('click', async () => {
    try {
      await navigator.share({ files: [archivo], title: 'Busca Huellitas', text: textoCompartir });
    } catch { /* si cancela el menú de compartir, no pasa nada */ }
  });

  document.body.appendChild(capa);
  document.addEventListener('keydown', alTeclear, true);
  mostrar(canvas).then(() => capa.querySelector('[data-cartel="guardar"]').focus());
}

export async function generarCartel(report) {
  toast('Preparando el cartel…', 'info');

  await fetchContacto(report);

  const canvas = await construirCartel(report);
  const nombre = report.pet_name || nombreAnimal(report);
  const meta = CARTEL[report.kind] ?? CARTEL.perdido;
  const titular = report.lifecycle === 'resuelto' ? 'VOLVIÓ A CASA' : meta.titulo;

  abrirVentanaCartel({
    report,
    canvas,
    nombreArchivo: `cartel-${nombre.replace(/\s+/g, '-').toLowerCase()}.png`,
    titulo: `Cartel de ${nombre}`,
    textoCompartir: `${titular}: ${nombre}`,
  });
}
