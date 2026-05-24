// ============================================================================
// Compresión de imágenes en el navegador (antes de subir a Storage).
// Redimensiona el lado mayor a ~1280px y reexporta como JPEG calidad 0.7.
// Una foto de celular de 4–8 MB suele quedar bajo 300 KB.
// ============================================================================

export async function comprimirImagen(file, { maxLado = 1280, calidad = 0.7 } = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }

  const bitmap = await createImageBitmap(file);
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

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))),
      'image/jpeg',
      calidad
    );
  });

  return blob;
}
