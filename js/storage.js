// ============================================================================
// Subida de fotos al bucket `report-photos` de Supabase Storage.
// Ruta: {user_id}/{uuid}.jpg  (las políticas RLS exigen la carpeta propia).
// ============================================================================
import { supabase } from './supabase.js';

export async function subirFoto(blob, userId) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from('report-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error('No se pudo subir la foto: ' + error.message);

  const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
  return { url: data.publicUrl, path };
}
