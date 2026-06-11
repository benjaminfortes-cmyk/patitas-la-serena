-- ============================================================================
-- Patitas La Serena — Esquema inicial
-- Backend: Supabase (PostgreSQL + PostGIS)
--
-- Este archivo crea TODO el backend: extensiones, tipos, tablas, índices,
-- políticas de seguridad (RLS), funciones de servidor (RPC) y tareas
-- programadas (pg_cron). Está pensado para correrse de una sola vez.
--
-- Convención: la lógica sensible (límite diario, validaciones,
-- permisos) vive en la base de datos, NO en el cliente. El frontend nunca
-- inserta directo en `reports`: siempre pasa por la función create_report().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensiones
-- ----------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;       -- consultas geográficas (radio, distancia)
create extension if not exists pg_cron;        -- tareas programadas (caducidad, archivado)
-- gen_random_uuid() ya viene disponible en Postgres 13+ (Supabase)

-- ----------------------------------------------------------------------------
-- 2. Tipos enumerados
--    Separamos "tipo de reporte" (kind) del "estado del ciclo de vida" (lifecycle)
--    para evitar confusiones.
-- ----------------------------------------------------------------------------
create type report_kind      as enum ('perdido', 'encontrado', 'avistado');   -- 🔴🟢🔵
create type report_lifecycle as enum ('activo', 'resuelto', 'archivado');
create type animal_type       as enum ('perro', 'gato', 'otro');
create type animal_size       as enum ('chico', 'mediano', 'grande');
create type flag_reason       as enum ('incorrecta', 'duplicada', 'spam', 'otro');
create type user_role         as enum ('user', 'admin');

-- ----------------------------------------------------------------------------
-- 3. Tablas
-- ----------------------------------------------------------------------------

-- 3.1 Perfiles (extiende auth.users de Supabase)
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  phone           text,                          -- E.164, opcional (futuro login SMS)
  role            user_role   not null default 'user',
  is_blocked      boolean     not null default false,
  flags_received  integer     not null default 0,  -- denuncias acumuladas (moderación)
  created_at      timestamptz not null default now()
);

-- 3.2 Reportes (tabla central)
create table public.reports (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,

  kind               report_kind      not null,
  lifecycle          report_lifecycle not null default 'activo',
  animal_type        animal_type      not null,
  animal_type_other  text,                         -- solo si animal_type = 'otro'

  pet_name           text,                         -- opcional; solo aplica a 'perdido'
  breed              text,                         -- raza aproximada
  color              text,                         -- color / señas particulares
  size               animal_size,

  event_at           timestamptz not null default now(),  -- cuándo ocurrió

  -- Ubicación exacta marcada por quien publica. SRID 4326 = lat/lng estándar.
  location           extensions.geography(Point, 4326) not null,

  photo_url          text not null,                -- URL pública en Storage
  photo_path         text not null,                -- ruta interna (para poder borrar)

  description        text,                         -- libre, máx 500 (validado en función)
  contact_whatsapp   text not null,                -- E.164: +569XXXXXXXX

  resolved_at        timestamptz,                  -- se llena al marcar resuelto
  last_active_at     timestamptz not null default now(),  -- reinicia con "Sigue activo"
  flags_count        integer not null default 0,   -- denuncias sobre ESTE reporte

  -- Texto de búsqueda generado para el buscador (nombre/raza/color/descripción).
  -- to_tsvector con config literal es inmutable, por eso se puede generar.
  search_text        tsvector generated always as (
    to_tsvector(
      'spanish',
      coalesce(pet_name, '') || ' ' ||
      coalesce(breed, '')    || ' ' ||
      coalesce(color, '')    || ' ' ||
      coalesce(description, '')
    )
  ) stored,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 3.3 Denuncias de info incorrecta / duplicada
create table public.flags (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.reports(id) on delete cascade,
  reporter_user_id  uuid not null references public.profiles(id) on delete cascade,
  reason            flag_reason not null,
  note              text,
  created_at        timestamptz not null default now(),
  -- un mismo usuario no puede denunciar dos veces el mismo reporte
  unique (report_id, reporter_user_id)
);

-- 3.4 Suscripciones de alerta por cercanía ("avísame en mi zona")
create table public.alert_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  center       extensions.geography(Point, 4326) not null,  -- punto elegido (ej: la casa)
  radius_m     integer not null check (radius_m in (1000, 3000, 5000)),
  animal_type  animal_type,                       -- null = todos los animales
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 3.5 Endpoints Web Push (un registro por dispositivo/navegador)
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,   -- claves públicas que entrega el navegador
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Índices
-- ----------------------------------------------------------------------------
create index reports_location_idx     on public.reports using gist (location);
create index reports_search_idx       on public.reports using gin  (search_text);
create index reports_lifecycle_idx    on public.reports (lifecycle);
create index reports_kind_idx         on public.reports (kind);
create index reports_animal_type_idx  on public.reports (animal_type);
create index reports_event_at_idx     on public.reports (event_at desc);
create index reports_user_idx         on public.reports (user_id);
create index alerts_center_idx        on public.alert_subscriptions using gist (center);

-- ----------------------------------------------------------------------------
-- 5. Helpers de autorización
-- ----------------------------------------------------------------------------

-- ¿El usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 6. Trigger: crear perfil automáticamente al registrarse un usuario
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 7. Función central: create_report()
--    - Verifica que el usuario no esté bloqueado.
--    - Aplica el LÍMITE de 3 reportes por usuario por día.
--    - Guarda la ubicación EXACTA recibida (sin offset de privacidad).
--    - Valida formato de WhatsApp chileno y largo de la descripción.
-- ----------------------------------------------------------------------------
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
  v_today     integer;
  v_location  extensions.geography(Point, 4326);
  v_new       public.reports;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para publicar.' using errcode = '42501';
  end if;

  -- Cuenta bloqueada / en revisión
  select is_blocked into v_blocked from public.profiles where id = v_uid;
  if v_blocked then
    raise exception 'Tu cuenta está en revisión y no puede publicar.' using errcode = '42501';
  end if;

  -- Límite antifraude: máximo 3 publicaciones por usuario en las últimas 24h
  select count(*) into v_today
  from public.reports
  where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_today >= 3 then
    raise exception 'Llegaste al máximo de 3 publicaciones por día.' using errcode = 'P0001';
  end if;

  -- Validación de WhatsApp chileno: +569 seguido de 8 dígitos
  if p_contact_whatsapp !~ '^\+569[0-9]{8}$' then
    raise exception 'El WhatsApp debe tener formato +569XXXXXXXX.' using errcode = '22023';
  end if;

  -- Validación de largo de descripción
  if char_length(coalesce(p_description, '')) > 500 then
    raise exception 'La descripción no puede superar 500 caracteres.' using errcode = '22023';
  end if;

  -- Ubicación EXACTA: se guarda el punto tal cual lo marca la persona.
  -- (El offset de privacidad fue retirado a petición del autor del proyecto.)
  v_location := extensions.ST_SetSRID(
    extensions.ST_MakePoint(p_lng, p_lat), 4326
  )::extensions.geography;

  insert into public.reports (
    user_id, kind, animal_type, animal_type_other, pet_name, breed, color,
    size, event_at, location, photo_url, photo_path, description, contact_whatsapp
  )
  values (
    v_uid, p_kind, p_animal_type,
    nullif(trim(coalesce(p_animal_type_other, '')), ''),
    nullif(trim(coalesce(p_pet_name, '')), ''),
    nullif(trim(coalesce(p_breed, '')), ''),
    nullif(trim(coalesce(p_color, '')), ''),
    p_size, p_event_at, v_location, p_photo_url, p_photo_path,
    nullif(trim(coalesce(p_description, '')), ''),
    p_contact_whatsapp
  )
  returning * into v_new;

  return v_new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Matching inteligente: find_matches()
--    Dado un reporte, busca candidatos del tipo OPUESTO, mismo animal,
--    dentro de 3 km y publicados en los últimos 30 días.
--    - perdido  -> busca encontrado/avistado
--    - encontrado/avistado -> busca perdido
--    Devuelve también la distancia en metros, ordenado por cercanía.
-- ----------------------------------------------------------------------------
create or replace function public.find_matches(p_report_id uuid)
returns table (
  id           uuid,
  kind         report_kind,
  animal_type  animal_type,
  pet_name     text,
  breed        text,
  color        text,
  photo_url    text,
  event_at     timestamptz,
  distance_m   double precision
)
language sql
security definer
set search_path = public, extensions
stable
as $$
  with src as (
    select * from public.reports where id = p_report_id
  )
  select
    r.id, r.kind, r.animal_type, r.pet_name, r.breed, r.color,
    r.photo_url, r.event_at,
    extensions.ST_Distance(r.location, src.location) as distance_m
  from public.reports r, src
  where r.id <> src.id
    and r.lifecycle = 'activo'
    and r.animal_type = src.animal_type
    and r.created_at > now() - interval '30 days'
    -- tipo opuesto: si el origen es 'perdido' buscamos los que NO son 'perdido', y viceversa
    and case
          when src.kind = 'perdido' then r.kind <> 'perdido'
          else r.kind = 'perdido'
        end
    and extensions.ST_DWithin(r.location, src.location, 3000)   -- 3 km
  order by distance_m asc
  limit 12;
$$;

-- ----------------------------------------------------------------------------
-- 9. Acciones del dueño: resolver, reactivar, editar
--    Todas verifican propiedad (user_id = auth.uid()) salvo admin.
-- ----------------------------------------------------------------------------

-- Marcar como resuelto (queda 7 días visible con badge "¡Reunidos!")
create or replace function public.mark_resolved(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.reports
  set lifecycle = 'resuelto', resolved_at = now(), updated_at = now()
  where id = p_report_id
    and (user_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'No tienes permiso sobre este reporte.' using errcode = '42501';
  end if;
end;
$$;

-- Reactivar contador de caducidad ("Sigue activo")
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
    and (user_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'No tienes permiso sobre este reporte.' using errcode = '42501';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. Denuncias: flag_report()
--     Inserta la denuncia, incrementa contadores y, al pasar el umbral (3),
--     OCULTA el reporte (lo manda a archivado) para que un admin lo revise.
--     No bloquea cuentas automáticamente (decisión: cola de moderación).
-- ----------------------------------------------------------------------------
create or replace function public.flag_report(
  p_report_id uuid,
  p_reason    flag_reason,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid          uuid := auth.uid();
  v_owner        uuid;
  v_flags        integer;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para denunciar.' using errcode = '42501';
  end if;

  insert into public.flags (report_id, reporter_user_id, reason, note)
  values (p_report_id, v_uid, p_reason, p_note)
  on conflict (report_id, reporter_user_id) do nothing;

  -- Recalcular contador del reporte y del dueño
  update public.reports
  set flags_count = (select count(*) from public.flags where report_id = p_report_id)
  where id = p_report_id
  returning user_id, flags_count into v_owner, v_flags;

  update public.profiles
  set flags_received = (
    select count(*) from public.flags f
    join public.reports r on r.id = f.report_id
    where r.user_id = v_owner
  )
  where id = v_owner;

  -- Umbral: 3+ denuncias -> ocultar (archivar) para revisión del admin.
  if v_flags >= 3 then
    update public.reports set lifecycle = 'archivado', updated_at = now()
    where id = p_report_id;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. Tareas programadas (pg_cron) — corren a las 04:00 (hora del servidor)
--
-- Nota: los reportes RESUELTOS NO se archivan: quedan como 'resuelto' para
-- alimentar la sección "Historias felices" (prueba social). En el mapa solo
-- se muestran durante 7 días; ese filtro se aplica al consultar (en el cliente),
-- no borrando datos.
-- ----------------------------------------------------------------------------

-- 11.1 Ocultar reportes activos sin actualización en 45 días (no se borran)
select cron.schedule(
  'caducar-inactivos',
  '5 4 * * *',
  $$ update public.reports
     set lifecycle = 'archivado', updated_at = now()
     where lifecycle = 'activo' and last_active_at < now() - interval '45 days'; $$
);

-- ----------------------------------------------------------------------------
-- 12. Row Level Security (RLS)
-- ----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.reports             enable row level security;
alter table public.flags               enable row level security;
alter table public.alert_subscriptions enable row level security;
alter table public.push_subscriptions  enable row level security;

-- 12.1 profiles: cada quien ve/edita el suyo; el admin ve todos
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- 12.2 reports: lectura PÚBLICA de lo no archivado (sin login para ver el mapa).
--      El dueño y el admin ven también lo archivado.
create policy reports_select_public on public.reports
  for select using (
    lifecycle <> 'archivado' or user_id = auth.uid() or public.is_admin()
  );
-- NO hay política de INSERT: los reportes solo se crean vía create_report()
-- (SECURITY DEFINER), así nadie inserta saltándose las validaciones ni el límite.
-- UPDATE directo solo para dueño/admin (las funciones igual lo cubren).
create policy reports_update_owner on public.reports
  for update using (user_id = auth.uid() or public.is_admin());
create policy reports_delete_admin on public.reports
  for delete using (public.is_admin());

-- 12.3 flags: el usuario inserta vía flag_report(); el admin las lee
create policy flags_select_admin on public.flags
  for select using (public.is_admin() or reporter_user_id = auth.uid());

-- 12.4 alert_subscriptions: solo el dueño
create policy alerts_all_own on public.alert_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 12.5 push_subscriptions: solo el dueño
create policy push_all_own on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 13. Permisos de ejecución de las funciones RPC para clientes
-- ----------------------------------------------------------------------------
grant execute on function public.create_report     to authenticated;
grant execute on function public.find_matches       to anon, authenticated;
grant execute on function public.mark_resolved      to authenticated;
grant execute on function public.reactivate_report  to authenticated;
grant execute on function public.flag_report        to authenticated;
grant execute on function public.is_admin           to anon, authenticated;

-- ============================================================================
-- Fin del esquema. La búsqueda de texto y los filtros se arman en el cliente
-- con consultas a la vista pública de `reports` (PostgREST genera la API REST
-- automáticamente desde estas tablas y funciones).
-- ============================================================================
