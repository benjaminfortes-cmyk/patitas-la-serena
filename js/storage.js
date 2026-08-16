// Subida de fotos al bucket `report-photos` de Supabase Storage.

import { supabase } from './supabase.js';

export async function subirFoto(blob, userId) {
  const tipo = blob.type || 'image/jpeg';
  const ext = tipo === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('report-photos')
    .upload(path, blob, { contentType: tipo, upsert: false });

  if (error) throw new Error('No se pudo subir la foto: ' + error.message);

  const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
  return { url: data.publicUrl, path };
}
