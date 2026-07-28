-- ============================================================================
-- El teléfono deja de viajar en la lista pública
--
-- Problema: `reports_public` incluía `contact_whatsapp`, y esa vista la puede
-- leer cualquiera con la clave anónima (que va en el JavaScript, o sea, es
-- pública). Una sola consulta devolvía TODOS los reportes con TODOS los
-- teléfonos: material listo para spam o estafas a familias que acaban de
-- perder a su mascota.
--
-- Solución: el número sale de la vista y se entrega de a uno, solo cuando
-- alguien abre una ficha concreta, a través de get_report_contact(). Sigue
-- siendo accesible —tiene que serlo, es el punto de la app— pero ya no se
-- puede descargar la lista completa de un viaje.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. La vista pública, ahora sin el teléfono
-- ---------------------------------------------------------------------------
-- Postgres no deja quitar una columna con CREATE OR REPLACE VIEW: hay que
-- borrar la vista y crearla de nuevo.
drop view if exists public.reports_public;

create view public.reports_public
with (security_invoker = true) as
select
  id,
  user_id,
  kind,
  lifecycle,
  animal_type,
  animal_type_other,
  pet_name,
  breed,
  color,
  size,
  event_at,
  ST_Y(location::geometry) as lat,   -- latitud  (ubicación exacta marcada al publicar)
  ST_X(location::geometry) as lng,   -- longitud (ubicación exacta marcada al publicar)
  photo_url,
  description,
  -- contact_whatsapp: ya no va acá. Ver get_report_contact() más abajo.
  resolved_at,
  last_active_at,
  flags_count,
  created_at,
  updated_at
from public.reports;

grant select on public.reports_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. El teléfono de UN reporte, a pedido
-- ---------------------------------------------------------------------------
-- security definer: la función lee la tabla `reports` por su cuenta, sin que
-- haya que abrirle la columna al público.
--
-- Exige sesión iniciada. En la app todo el mundo tiene una (anónima, invisible,
-- se crea al abrir una ficha), así que para la persona no cambia nada; pero un
-- script que quiera raspar la base tiene que abrir una sesión por cada intento,
-- y ahí topa con el límite de registros anónimos por IP de Supabase.
create or replace function public.get_report_contact(p_report_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero text;
begin
  if auth.uid() is null then
    raise exception 'Se necesita una sesión para ver el contacto';
  end if;

  select contact_whatsapp
    into v_numero
    from public.reports
   where id = p_report_id
     and lifecycle <> 'archivado';

  return v_numero;
end;
$$;

revoke all on function public.get_report_contact(uuid) from public;
grant execute on function public.get_report_contact(uuid) to authenticated;

comment on function public.get_report_contact(uuid) is
  'Devuelve el WhatsApp de un reporte concreto. Existe para que el número no viaje en la lista pública y no se pueda descargar en bloque.';
