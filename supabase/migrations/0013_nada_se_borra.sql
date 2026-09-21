-- ============================================================================
-- Que no se borre ningún reporte
--
-- Contexto (auditoría del 2026-09-18): en el bucket `report-photos` había 144
-- fotos para 79 reportes. Las 65 de más son de reportes que existieron y ya no
-- están: la foto se queda en Storage porque el borrado nunca la limpiaba. 38
-- personas subieron foto y no tienen ningún reporte vivo.
--
-- Había dos caminos por los que un reporte desaparecía para siempre:
--
--   1. El botón "Borrar" de la ficha, que hacía un delete de verdad. Ese botón
--      ya no existe en la app: lo que se saca del mapa va a 'archivado' (la
--      papelera) y se puede volver a publicar. Acá se cierra también por abajo,
--      quitando el permiso de delete, para que no vuelva a entrar por una
--      versión vieja de la app guardada en caché ni por un script.
--
--   2. El borrado en cascada desde la cuenta. reports.user_id apuntaba a
--      profiles.id, y profiles.id a auth.users.id, las dos con ON DELETE
--      CASCADE: borrar UNA persona en el panel de Supabase se llevaba todos sus
--      reportes sin preguntar y sin dejar rastro. Como casi todo el mundo entra
--      con sesión anónima, una limpieza de usuarios anónimos habría vaciado el
--      mapa. Ahora el reporte sobrevive a su autor: queda con user_id en nulo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. El reporte sobrevive a la cuenta que lo publicó
-- ---------------------------------------------------------------------------
-- Sin autor, el reporte queda huérfano: nadie lo puede editar salvo el admin.
-- Eso es lo correcto — el aviso de una mascota perdida le sirve a la comunidad
-- aunque quien lo publicó ya no esté.
alter table public.reports alter column user_id drop not null;

-- Se busca la llave foránea por la columna y no por su nombre: si alguna vez se
-- creó con otro nombre, un `drop constraint if exists reports_user_id_fkey` no
-- la encontraría, la nueva se agregaría al lado y la vieja seguiría borrando en
-- cascada sin que se note.
do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.reports'::regclass
      and con.contype = 'f'
      and att.attname = 'user_id'
  loop
    execute format('alter table public.reports drop constraint %I', v_nombre);
  end loop;
end $$;

alter table public.reports
  add constraint reports_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Las políticas que comparan `user_id = auth.uid()` siguen funcionando: contra
-- un nulo la comparación no da verdadero, así que un reporte sin dueño
-- simplemente no tiene dueño. No hay que tocarlas.

-- ---------------------------------------------------------------------------
-- 2. Nadie borra reportes desde la aplicación
-- ---------------------------------------------------------------------------
-- Sin política de delete, Postgres rechaza cualquier intento de borrado hecho
-- con la llave pública (anon / authenticated). Desde el SQL Editor del panel de
-- Supabase sí se puede seguir borrando si alguna vez hace falta de verdad:
-- ahí se trabaja como dueño de la base y RLS no aplica.
drop policy if exists reports_delete_admin on public.reports;

-- ---------------------------------------------------------------------------
-- 3. Comprobación
-- ---------------------------------------------------------------------------
-- La primera consulta tiene que devolver UNA fila: 'YES' (user_id ya acepta
-- nulos) y 'SET NULL'. La segunda no debe devolver ninguna fila con cmd = 'DELETE'.
select c.is_nullable, rc.delete_rule
from information_schema.columns c
join information_schema.referential_constraints rc
  on rc.constraint_name = 'reports_user_id_fkey'
where c.table_schema = 'public' and c.table_name = 'reports' and c.column_name = 'user_id';

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'reports'
order by cmd;
