// ============================================================================
// Compresión de imágenes en el navegador (antes de subir a Storage).
//
// Redimensiona el lado mayor a ~1280px y reexporta en WebP. Se mantiene el
// tamaño y la calidad de siempre a propósito: de esta foto depende que alguien
// reconozca a su mascota. Lo que cambia es el formato — WebP pesa cerca de un
// tercio menos que JPEG a la misma calidad a la vista— y eso alivia el tráfico
// sin que la foto se vea peor.
// ============================================================================

// canvas.toBlob envuelto en promesa (devuelve null si el navegador no puede).
function aBlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

export async function comprimirImagen(file, { maxLado = 1280, calidad = 0.72 } = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }

  // Algunos formatos de celular (HEIC/HEIF de iPhone, AVIF) no los sabe
  // decodificar el navegador. El error nativo es incomprensible, así que lo
  // traducimos a algo accionable.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('No pudimos leer esa foto. Prueba con otra, o sácale una captura de pantalla y sube esa.');
  }

  let { width, height } = bitmap;

  if (Math.max(width, height) > maxLado) {
    const escala = maxLado / Math.max(width, height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Se guardan los dos formatos y se sube el más liviano. WebP casi siempre
  // gana, pero con fotos que ya venían comprimidas a veces pierde, y así nunca
  // subimos algo más pesado que antes. De paso resuelve a los navegadores que
  // no saben guardar WebP: ignoran el tipo pedido y devuelven un PNG enorme,
  // por eso solo se acepta el blob si salió del tipo que corresponde.
  const [webp, jpeg] = await Promise.all([
    aBlob(canvas, 'image/webp', calidad),
    aBlob(canvas, 'image/jpeg', 0.7),
  ]);
  const soloSi = (b, tipo) => (b && b.type === tipo ? b : null);
  const w = soloSi(webp, 'image/webp');
  const j = soloSi(jpeg, 'image/jpeg');

  const blob = (w && j) ? (w.size <= j.size ? w : j) : (w || j);
  if (!blob) throw new Error('No se pudo procesar la imagen.');

  return blob;
}
