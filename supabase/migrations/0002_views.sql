-- ============================================================================
-- Vista pública de reportes para el mapa
--
-- PostGIS guarda `location` en formato binario, incómodo de leer desde el
-- cliente. Esta vista expone lat/lng como números y solo los campos que el
-- frontend necesita (NO incluye photo_path ni search_text internos).
--
-- security_invoker = true  ->  la vista respeta las políticas RLS de la tabla
-- base `reports` (anónimos solo ven lo no archivado; el dueño/admin ven más).
-- ============================================================================
create or replace view public.reports_public
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
  contact_whatsapp,
  resolved_at,
  last_active_at,
  flags_count,
  created_at,
  updated_at
from public.reports;

grant select on public.reports_public to anon, authenticated;
