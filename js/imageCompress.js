// Compresión de imágenes en el navegador (antes de subir a Storage).

function aBlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

export async function comprimirImagen(file, { maxLado = 1280, calidad = 0.72 } = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }

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
