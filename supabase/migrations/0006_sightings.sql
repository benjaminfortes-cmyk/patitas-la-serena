-- ============================================================================
-- Pistas "Yo lo vi": avistamientos que cualquiera puede dejar en un reporte.
--
-- La idea: quien vio al animal marca un punto en el mapa y deja una nota, sin
-- tener que dar su teléfono. Así el dueño ve un rastro de por dónde anda su
-- mascota. Sigue el mismo patrón que el resto del backend: se inserta solo vía
-- una función SECURITY DEFINER (add_sighting), nunca directo a la tabla.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla
-- ----------------------------------------------------------------------------
create table public.sightings (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id)  on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  location    extensions.geography(Point, 4326) not null,  -- dónde lo vieron
  note        text,                                        -- nota libre (máx 300)
  created_at  timestamptz not null default now()
);

create index sightings_report_idx on public.sightings (report_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Función para dejar una pista: add_sighting()
--    - Exige sesión (aunque sea anónima) y cuenta no bloqueada.
--    - Valida largo de la nota y que el reporte esté visible (no archivado).
--    - Límite antiabuso: máximo 20 pistas por usuario en 24 horas.
-- ----------------------------------------------------------------------------
create or replace function public.add_sighting(
  p_report_id uuid,
  p_lat       double precision,
  p_lng       double precision,
  p_note      text default null
)
returns public.sightings
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_blocked   boolean;
  v_lifecycle report_lifecycle;
  v_today     integer;
  v_new       public.sightings;
begin
  if v_uid is null then
    raise exception 'Necesitas una sesión para dejar una pista.' using errcode = '42501';
  end if;

  select is_blocked into v_blocked from public.profiles where id = v_uid;
  if v_blocked then
    raise exception 'Tu cuenta está en revisión.' using errcode = '42501';
  end if;

  -- El reporte tiene que existir y estar visible.
  select lifecycle into v_lifecycle from public.reports where id = p_report_id;
  if v_lifecycle is null then
    raise exception 'Ese reporte no existe.' using errcode = 'P0002';
  end if;
  if v_lifecycle = 'archivado' then
    raise exception 'Ese reporte ya no está disponible.' using errcode = 'P0001';
  end if;

  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'La nota no puede superar 300 caracteres.' using errcode = '22023';
  end if;

  select count(*) into v_today
  from public.sightings
  where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_today >= 20 then
    raise exception 'Llegaste al máximo de pistas por hoy.' using errcode = 'P0001';
  end if;

  insert into public.sightings (report_id, user_id, location, note)
  values (
    p_report_id, v_uid,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_new;

  return v_new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Vista pública: expone lat/lng como números y esconde columnas internas.
--    security_invoker respeta el RLS de la tabla base.
-- ----------------------------------------------------------------------------
create or replace view public.sightings_public
with (security_invoker = true) as
select
  id,
  report_id,
  ST_Y(location::geometry) as lat,
  ST_X(location::geometry) as lng,
  note,
  created_at
from public.sightings;

grant select on public.sightings_public to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.sightings enable row level security;

-- Lectura pública de las pistas de reportes visibles (el mismo criterio del mapa).
create policy sightings_select_public on public.sightings
  for select using (
    exists (
      select 1 from public.reports r
      where r.id = report_id
        and (r.lifecycle <> 'archivado' or r.user_id = auth.uid() or public.is_admin())
    )
  );

-- El admin puede borrar pistas (moderación); el autor también las suyas.
create policy sightings_delete_own on public.sightings
  for delete using (user_id = auth.uid() or public.is_admin());
-- NO hay política de INSERT: las pistas solo entran por add_sighting().

-- ----------------------------------------------------------------------------
-- 5. Permisos de ejecución
-- ----------------------------------------------------------------------------
grant execute on function public.add_sighting to authenticated;

-- ============================================================================
-- Fin. El frontend lee sightings_public filtrando por report_id y deja pistas
-- llamando a add_sighting().
-- ============================================================================
