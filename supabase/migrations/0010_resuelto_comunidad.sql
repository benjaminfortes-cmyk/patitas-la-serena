-- ----------------------------------------------------------------------------
-- 0010: cualquiera puede avisar que una mascota volvió a casa
--
-- Antes el botón "resuelto" era solo del dueño, y mucha gente publica desde un
-- celular prestado: al volver ya es otra sesión anónima y el botón no aparece.
--
--   dueño o admin  -> mark_resolved()  : resuelto directo.
--   cualquier otro -> report_reunion() : resuelto con resolution_review = true
--                                        ("en revisión"), hasta que el admin
--                                        confirme o lo devuelva a activo.
-- ----------------------------------------------------------------------------

-- 1. Columnas nuevas
alter table public.reports
  add column if not exists resolution_review     boolean not null default false,
  add column if not exists resolution_claimed_by uuid references auth.users(id) on delete set null;

-- Índice parcial: los avisos pendientes son pocos, la lista del admin sale directa.
create index if not exists reports_en_revision_idx
  on public.reports (resolved_at desc)
  where resolution_review;

-- 2. La vista pública expone el estado "en revisión"
-- La columna va al final para que baste CREATE OR REPLACE.
-- resolution_claimed_by no se expone: es un id de usuario.
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
  ST_Y(location::geometry) as lat,
  ST_X(location::geometry) as lng,
  photo_url,
  description,
  -- contact_whatsapp: fuera desde la 0007. Ver get_report_contact().
  resolved_at,
  last_active_at,
  flags_count,
  created_at,
  updated_at,
  resolution_review
from public.reports;

grant select on public.reports_public to anon, authenticated;

-- 3. Aviso de la comunidad
create or replace function public.report_reunion(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_recientes integer;
begin
  if v_uid is null then
    raise exception 'Se necesita una sesión para avisar.' using errcode = '42501';
  end if;

  -- Tope de 5 avisos por hora y por sesión, contra el vandalismo.
  select count(*) into v_recientes
    from public.reports
   where resolution_claimed_by = v_uid
     and resolved_at > now() - interval '1 hour';

  if v_recientes >= 5 then
    raise exception 'Enviaste varios avisos seguidos. Intenta más tarde.' using errcode = 'P0001';
  end if;

  update public.reports
     set lifecycle             = 'resuelto',
         resolved_at           = now(),
         resolution_review     = true,
         resolution_claimed_by = v_uid,
         updated_at            = now()
   where id = p_report_id
     and lifecycle = 'activo';

  if not found then
    raise exception 'Ese reporte ya no está activo.' using errcode = 'P0002';
  end if;
end;
$$;

-- 3.b. La de la 0001, más resolution_review = false: si el dueño lo marca desde
-- su sesión real, el aviso pendiente deja de estarlo.
create or replace function public.mark_resolved(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.reports
  set lifecycle = 'resuelto', resolved_at = now(),
      resolution_review = false, updated_at = now()
  where id = p_report_id
    and (user_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'No tienes permiso sobre este reporte.' using errcode = '42501';
  end if;
end;
$$;

-- 4. Moderación del aviso (solo admin)
create or replace function public.confirm_resolution(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede confirmar.' using errcode = '42501';
  end if;

  update public.reports
     set resolution_review = false,
         updated_at        = now()
   where id = p_report_id
     and resolution_review;

  if not found then
    raise exception 'Ese aviso ya no está pendiente.' using errcode = 'P0002';
  end if;
end;
$$;

-- Rechazar: vuelve a activo y se le reinicia la caducidad.
create or replace function public.reject_resolution(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede rechazar.' using errcode = '42501';
  end if;

  update public.reports
     set lifecycle             = 'activo',
         resolved_at           = null,
         resolution_review     = false,
         resolution_claimed_by = null,
         last_active_at        = now(),
         updated_at            = now()
   where id = p_report_id
     and resolution_review;

  if not found then
    raise exception 'Ese aviso ya no está pendiente.' using errcode = 'P0002';
  end if;
end;
$$;

-- 5. Permisos. Las dos de moderación exigen is_admin() por dentro.
grant execute on function public.report_reunion(uuid)     to authenticated;
grant execute on function public.confirm_resolution(uuid) to authenticated;
grant execute on function public.reject_resolution(uuid)  to authenticated;
