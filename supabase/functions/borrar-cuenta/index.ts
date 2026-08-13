
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ---- Quién llama --------------------------------------------------------
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'falta la sesión' }, 401);

    const admin = createClient(url, servicio, { auth: { persistSession: false } });

    
    const { data: { user }, error: errUser } = await admin.auth.getUser(token);
    if (errUser || !user) return json({ error: 'sesión inválida' }, 401);

   
    try {
      const { data: reportes } = await admin
        .from('reports')
        .select('photo_path')
        .eq('user_id', user.id);

      const rutas = (reportes ?? [])
        .map((r: { photo_path: string | null }) => r.photo_path)
        .filter((p): p is string => !!p);

      if (rutas.length) {
        const { error } = await admin.storage.from('report-photos').remove(rutas);
        if (error) console.error('No se pudieron borrar algunas fotos:', error.message);
      }
    } catch (e) {
      console.error('Fallo al limpiar las fotos:', e);
    }

    // Borra la cuenta. El cascade arrastra perfil, reportes, denuncias,
    // alertas, avistamientos y suscripciones push (ver 0001_init_1.sql).
    const { error: errBorrar } = await admin.auth.admin.deleteUser(user.id);
    if (errBorrar) {
      console.error('No se pudo borrar la cuenta:', errBorrar.message);
      return json({ error: 'no se pudo borrar la cuenta' }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('Error inesperado:', e);
    return json({ error: 'error inesperado' }, 500);
  }
});
