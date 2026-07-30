-- ============================================================================
-- El contacto se ve sin necesidad de sesión
--
-- La 0007 sacó el teléfono de la vista pública (bien: evitaba que una sola
-- consulta devolviera TODOS los números) y además exigió sesión iniciada para
-- pedirlo. Eso segundo se cae acá: la app es para que la gente contacte, y
-- pedir sesión obligaba a crear un usuario anónimo en Supabase por cada
-- persona que abre una ficha —gasto y un límite por IP que en una hora de
-- mucho tráfico podía dejar a alguien sin poder ver el número—.
--
-- Lo que SÍ se mantiene: el número no viaja en `reports_public`. Se sigue
-- entregando de a uno, por reporte, así que no hay una consulta que devuelva
-- la lista completa de teléfonos. Un script decidido puede recorrer los
-- reportes pidiéndolos uno por uno; si eso llegara a pasar, la respuesta es
-- limitar por IP (rate limit), no volver a pedir sesión.
-- ============================================================================

create or replace function public.get_report_contact(p_report_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero text;
begin
  -- Sin control de sesión: cualquiera que abra una ficha ve el número.
  select contact_whatsapp
    into v_numero
    from public.reports
   where id = p_report_id
     and lifecycle <> 'archivado';

  return v_numero;
end;
$$;

revoke all on function public.get_report_contact(uuid) from public;
grant execute on function public.get_report_contact(uuid) to anon, authenticated;

comment on function public.get_report_contact(uuid) is
  'Devuelve el WhatsApp de un reporte concreto, sin exigir sesión. Existe para que el número no viaje en la lista pública y no se pueda descargar en bloque.';
