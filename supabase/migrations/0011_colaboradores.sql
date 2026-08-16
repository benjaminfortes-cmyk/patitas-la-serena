-- 0011: rol 'colaborador' para las organizaciones aliadas.
--
-- Modera igual que el admin (archivar, borrar, editar, confirmar reencuentros)
-- pero no ve las estadísticas: por eso is_admin() sigue siendo solo el admin y
-- la moderación pasa a is_staff(). Sus reportes quedan firmados con el nombre
-- de la organización. Quién es colaborador se define en scripts/colaboradores.sql.

-- Si Postgres reclama "unsafe use of new value of enum type", corre sola esta
-- línea y después el resto del archivo.
alter type user_role add value if not exists 'colaborador';

alter table public.profiles add column if not exists org_name text;
alter table public.reports  add column if not exists author_org text;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role::text in ('admin', 'colaborador')
  );
$$;

grant execute on function public.is_staff to anon, authenticated;

-- create_report(): igual que en la 0001, más el tope según el rol y la firma.
create or replace function public.create_report(
  p_kind              report_kind,
  p_animal_type       animal_type,
  p_lat               double precision,
  p_lng               double precision,
  p_photo_url         text,
  p_photo_path        text,
  p_contact_whatsapp  text,
  p_animal_type_other text default null,
  p_pet_name          text default null,
  p_breed             text default null,
  p_color             text default null,
  p_size              animal_size default null,
  p_event_at          timestamptz default now(),
  p_description       text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_blocked   boolean;
  v_role      text;
  v_org       text;
  v_tope      integer;
  v_today     integer;
  v_location  extensions.geography(Point, 4326);
  v_new       public.reports;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para publicar.' using errcode = '42501';
  end if;

  select is_blocked, role::text, nullif(trim(coalesce(org_name, '')), '')
    into v_blocked, v_role, v_org
    from public.profiles where id = v_uid;

  if v_blocked then
    raise exception 'Tu cuenta está en revisión y no puede publicar.' using errcode = '42501';
  end if;

  -- 3 publicaciones al día para el público; 20 para el equipo, que sube los
  -- rescates del día de una sentada.
  v_tope := case when v_role in ('admin', 'colaborador') then 20 else 3 end;

  select count(*) into v_today
  from public.reports
  where user_id = v_uid and created_at > now() - interval '24 hours';

  if v_today >= v_tope then
    raise exception 'Llegaste al máximo de % publicaciones por día.', v_tope using errcode = 'P0001';
  end if;

  if p_contact_whatsapp !~ '^\+569[0-9]{8}$' then
    raise exception 'El WhatsApp debe tener formato +569XXXXXXXX.' using errcode = '22023';
  end if;

  if char_length(coalesce(p_description, '')) > 500 then
    raise exception 'La descripción no puede superar 500 caracteres.' using errcode = '22023';
  end if;

  v_location := extensions.ST_SetSRID(
    extensions.ST_MakePoint(p_lng, p_lat), 4326
  )::extensions.geography;

  insert into public.reports (
    user_id, kind, animal_type, animal_type_other, pet_name, breed, color,
    size, event_at, location, photo_url, photo_path, description,
    contact_whatsapp, author_org
  )
  values (
    v_uid, p_kind, p_animal_type,
    nullif(trim(coalesce(p_animal_type_other, '')), ''),
    nullif(trim(coalesce(p_pet_name, '')), ''),
    nullif(trim(coalesce(p_breed, '')), ''),
    nullif(trim(coalesce(p_color, '')), ''),
    p_size, p_event_at, v_location, p_photo_url, p_photo_path,
    nullif(trim(coalesce(p_description, '')), ''),
    p_contact_whatsapp,
    case when v_role in ('admin', 'colaborador') then v_org end
  )
  returning * into v_new;

  return v_new;
end;
$$;

-- author_org va al final para que baste CREATE OR REPLACE.
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
  resolved_at,
  last_active_at,
  flags_count,
  created_at,
  updated_at,
  resolution_review,
  author_org
from public.reports;

grant select on public.reports_public to anon, authenticated;

-- Donde antes decía is_admin(), ahora dice is_staff().

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
    and (user_id = auth.uid() or public.is_staff());
  if not found then
    raise exception 'No tienes permiso sobre este reporte.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.reactivate_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.reports
  set last_active_at = now(),
      lifecycle = case when lifecycle = 'archivado' then 'activo' else lifecycle end,
      updated_at = now()
  where id = p_report_id
    and (user_id = auth.uid() or public.is_staff());
  if not found then
    raise exception 'No tienes permiso sobre este reporte.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.confirm_resolution(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_staff() then
    raise exception 'No tienes permiso para confirmar.' using errcode = '42501';
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

create or replace function public.reject_resolution(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_staff() then
    raise exception 'No tienes permiso para rechazar.' using errcode = '42501';
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

drop policy if exists reports_select_public on public.reports;
create policy reports_select_public on public.reports
  for select using (
    lifecycle <> 'archivado' or user_id = auth.uid() or public.is_staff()
  );

drop policy if exists reports_update_owner on public.reports;
create policy reports_update_owner on public.reports
  for update using (user_id = auth.uid() or public.is_staff());

-- Para que los colaboradores solo puedan archivar y no borrar, cambia
-- is_staff() por is_admin() en esta política.
drop policy if exists reports_delete_admin on public.reports;
create policy reports_delete_admin on public.reports
  for delete using (public.is_staff());

drop policy if exists flags_select_admin on public.flags;
create policy flags_select_admin on public.flags
  for select using (public.is_staff() or reporter_user_id = auth.uid());

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_staff());

select role, count(*) from public.profiles group by role order by role;
