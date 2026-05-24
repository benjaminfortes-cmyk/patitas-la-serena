// ============================================================================
// Edge Function: send-push
//
// Se dispara con un "Database Webhook" de Supabase ante un INSERT en
// public.reports. Busca las suscripciones cercanas (subscribers_for_report)
// y les envía una notificación Web Push con las claves VAPID.
//
// Variables de entorno (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu@correo.cl)
// ============================================================================
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANIMAL: Record<string, string> = { perro: 'perro', gato: 'gato', otro: 'animal' };
const KIND: Record<string, string> = {
  perdido: 'perdido', encontrado: 'encontrado y resguardado', avistado: 'avistado suelto',
};

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();          // fila insertada (payload del webhook)
    if (!record?.id) return new Response('sin record', { status: 400 });

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Suscripciones que deben recibir el aviso
    const { data: subs, error } = await supabase.rpc('subscribers_for_report', {
      p_report_id: record.id,
    });
    if (error) throw error;

    const animal = ANIMAL[record.animal_type] ?? 'animal';
    const kind = KIND[record.kind] ?? 'reportado';
    const payload = JSON.stringify({
      title: 'Nuevo reporte cerca 🐾',
      body: `Alguien reportó un ${animal} ${kind} en tu zona.`,
      url: `./?reporte=${record.id}`,
    });

    // Envía a cada suscripción; ignora errores individuales (endpoints caducados).
    const envios = (subs ?? []).map((s: { endpoint: string; p256dh: string; auth: string }) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        .catch(() => {})
    );
    await Promise.all(envios);

    return new Response(JSON.stringify({ enviados: envios.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
