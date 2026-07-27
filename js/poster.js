// ============================================================================
// Cartel "Se busca" para imprimir o compartir.
//
// Dibuja en un canvas la foto y los datos del reporte con el logo de Busca
// Huellitas y el Instagram @buscahuellitas, y lo entrega como imagen para
// descargar o compartir. Pensado para pegar en postes o subir a estados.
// ============================================================================
import { KIND_META, nombreAnimal, fechaCorta } from './constants.js';
import { toast } from './ui.js';

const ANCHO = 1080;
const ALTO = 1350;

// Título grande según el tipo de reporte, con su color.
const CARTEL = {
  perdido:    { titulo: 'SE BUSCA',          color: '#EF4444' },
  encontrado: { titulo: 'BUSCA A SU FAMILIA', color: '#2563EB' },
  avistado:   { titulo: 'VISTO EN LA CALLE',  color: '#CA8A04' },
};

// +56994869261 -> +56 9 9486 9261
function formatearTelefono(num) {
  const s = String(num || '').replace(/[^0-9]/g, '');
  const m = s.match(/^56(9)(\d{4})(\d{4})$/);
  if (m) return `+56 ${m[1]} ${m[2]} ${m[3]}`;
  return num;
}

// Carga una imagen y espera a que esté lista. crossOrigin permite dibujar la
// foto de Supabase en el canvas sin "ensuciarlo" (si el servidor manda CORS).
function cargarImagen(src, conCors = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (conCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Rectángulo con esquinas redondeadas.
function panelRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Dibuja la foto recortada tipo "cover" dentro de un recuadro.
function dibujarFotoCover(ctx, img, x, y, w, h) {
  const escala = Math.max(w / img.width, h / img.height);
  const nw = img.width * escala;
  const nh = img.height * escala;
  const nx = x + (w - nw) / 2;
  const ny = y + (h - nh) / 2;
  ctx.save();
  panelRedondeado(ctx, x, y, w, h, 24);
  ctx.clip();
  ctx.drawImage(img, nx, ny, nw, nh);
  ctx.restore();
}

// Parte un texto en líneas que quepan en maxAncho, sin cortar palabras. Si no
// alcanza en maxLineas, termina la última con "…".
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
      // Última línea permitida: mete el resto y recorta con "…" si sobra.
      actual = palabras.slice(i).join(' ');
      break;
    }
  }
  lineas.push(actual);

  // Recorta la última línea si aún se pasa del ancho.
  const ultima = lineas.length - 1;
  if (ctx.measureText(lineas[ultima]).width > maxAncho) {
    let t = lineas[ultima];
    while (t && ctx.measureText(t + '…').width > maxAncho) t = t.slice(0, -1);
    lineas[ultima] = t.replace(/\s+\S*$/, '') + '…';
  }
  return lineas.slice(0, maxLineas);
}

// Título grande que se achica solo si el nombre es muy largo.
function textoQueEntra(ctx, texto, maxAncho, tamInicial, fuente) {
  let tam = tamInicial;
  do {
    ctx.font = `800 ${tam}px ${fuente}`;
    if (ctx.measureText(texto).width <= maxAncho) break;
    tam -= 4;
  } while (tam > 28);
  return tam;
}

// Dibuja el cartel completo y devuelve el canvas listo. Separado de la
// exportación para poder previsualizarlo o reutilizarlo.
export async function construirCartel(report) {
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  const FUENTE = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

  const meta = CARTEL[report.kind] ?? CARTEL.perdido;
  const resuelto = report.lifecycle === 'resuelto';
  const acento = resuelto ? '#16A34A' : meta.color;
  const titular = resuelto ? 'VOLVIÓ A CASA' : meta.titulo;

  // Fondo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // ---- Barra de marca (arriba) ------------------------------------------
  ctx.fillStyle = '#1f95b8';
  ctx.fillRect(0, 0, ANCHO, 132);
  try {
    const logo = await cargarImagen('assets/icon.svg');
    ctx.drawImage(logo, 40, 26, 80, 80);
  } catch { /* si no carga el logo, el cartel igual sale */ }
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = `800 46px ${FUENTE}`;
  ctx.fillText('Busca Huellitas', 140, 56);
  ctx.font = `600 26px ${FUENTE}`;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText('Región de Coquimbo', 140, 96);

  // ---- Franja del título (SE BUSCA) -------------------------------------
  ctx.fillStyle = acento;
  ctx.fillRect(0, 132, ANCHO, 108);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `800 62px ${FUENTE}`;
  ctx.fillText(titular, ANCHO / 2, 190);
  ctx.textAlign = 'left';

  // ---- Foto -------------------------------------------------------------
  const fotoY = 272;
  const fotoAlto = 560;
  try {
    const foto = await cargarImagen(report.photo_url, true);
    dibujarFotoCover(ctx, foto, 40, fotoY, ANCHO - 80, fotoAlto);
  } catch {
    // Sin foto (o bloqueada por CORS): recuadro gris con una patita.
    ctx.fillStyle = '#eef3f5';
    panelRedondeado(ctx, 40, fotoY, ANCHO - 80, fotoAlto, 24);
    ctx.fill();
    ctx.fillStyle = '#9fb3ba';
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FUENTE}`;
    ctx.fillText('Foto no disponible', ANCHO / 2, fotoY + fotoAlto / 2);
    ctx.textAlign = 'left';
  }

  // ---- Nombre y datos ---------------------------------------------------
  let y = fotoY + fotoAlto + 70;
  const nombre = report.pet_name || nombreAnimal(report);
  ctx.fillStyle = '#12303a';
  ctx.textAlign = 'center';
  const tamNombre = textoQueEntra(ctx, nombre, ANCHO - 120, 76, FUENTE);
  ctx.font = `800 ${tamNombre}px ${FUENTE}`;
  ctx.fillText(nombre, ANCHO / 2, y);
  y += 30;

  // Línea de datos (raza · tamaño · fecha)
  const SIZE = { chico: 'chico', mediano: 'mediano', grande: 'grande' };
  const datos = [
    nombreAnimal(report),
    report.breed,
    SIZE[report.size],
    report.kind === 'perdido' ? `se perdió el ${fechaCorta(report.event_at)}` : `visto el ${fechaCorta(report.event_at)}`,
  ].filter(Boolean).join('  ·  ');
  y += 42;
  ctx.fillStyle = '#5b7078';
  ctx.font = `600 30px ${FUENTE}`;
  ctx.fillText(datos, ANCHO / 2, y);

  // Señas particulares (si hay), envueltas en hasta dos líneas sin cortar palabras.
  if (report.color) {
    y += 48;
    ctx.font = `600 28px ${FUENTE}`;
    ctx.fillStyle = '#5b7078';
    const lineas = envolverTexto(ctx, `Señas: ${report.color}`, ANCHO - 120, 2);
    lineas.forEach((linea, i) => ctx.fillText(linea, ANCHO / 2, y + i * 38));
  }

  // ---- Caja de contacto WhatsApp ----------------------------------------
  const cajaY = ALTO - 250;
  ctx.fillStyle = '#25D366';
  panelRedondeado(ctx, 40, cajaY, ANCHO - 80, 120, 20);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `700 30px ${FUENTE}`;
  ctx.fillText('Si sabes algo, escribe por WhatsApp', ANCHO / 2, cajaY + 40);
  ctx.font = `800 52px ${FUENTE}`;
  ctx.fillText(formatearTelefono(report.contact_whatsapp), ANCHO / 2, cajaY + 84);

  // ---- Pie: Instagram ---------------------------------------------------
  ctx.fillStyle = '#12303a';
  ctx.font = `800 34px ${FUENTE}`;
  ctx.fillText('@buscahuellitas', ANCHO / 2, ALTO - 78);
  ctx.fillStyle = '#5b7078';
  ctx.font = `600 26px ${FUENTE}`;
  ctx.fillText('Síguenos en Instagram y ayúdanos a difundir', ANCHO / 2, ALTO - 40);
  ctx.textAlign = 'left';

  return canvas;
}

// Genera el cartel y lo comparte (celular) o lo descarga (escritorio).
export async function generarCartel(report) {
  toast('Preparando el cartel…', 'info');

  const canvas = await construirCartel(report);
  const nombre = report.pet_name || nombreAnimal(report);
  const meta = CARTEL[report.kind] ?? CARTEL.perdido;
  const titular = report.lifecycle === 'resuelto' ? 'VOLVIÓ A CASA' : meta.titulo;

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 0.92));
  if (!blob) return toast('No se pudo crear el cartel.', 'error');

  const nombreArchivo = `cartel-${nombre.replace(/\s+/g, '-').toLowerCase()}.png`;
  const archivo = new File([blob], nombreArchivo, { type: 'image/png' });

  // En celular, el menú nativo para compartir a WhatsApp/Instagram; si no,
  // descarga el archivo.
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'Busca Huellitas', text: `${titular}: ${nombre}` });
      return;
    } catch { /* si cancela, seguimos a la descarga */ }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
  toast('Cartel descargado.', 'exito');
}
