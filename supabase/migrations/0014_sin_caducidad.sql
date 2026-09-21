-- ============================================================================
-- Se acabó la caducidad: un reporte no desaparece por viejo
--
-- Desde la 0001 corría una tarea (`caducar-inactivos`, todos los días a las
-- 04:05) que mandaba a 'archivado' cualquier reporte activo con más de 45 días
-- sin novedades. No borraba nada, pero para la persona era lo mismo: publicaba
-- a su perro, pasaban seis semanas y su pin ya no estaba en el mapa. Sin aviso
-- por correo, sin nada: el único freno era un botón "Sigue activo" dentro de la
-- ficha, que casi nadie llegaba a ver.
--
-- A partir de acá un reporte se queda en el mapa hasta que alguien decida otra
-- cosa: lo marca como resuelto, o el equipo lo manda a la papelera a mano.
--
-- Lo que NO cambia: los reportes resueltos siguen saliendo del mapa a los 7
-- días y quedándose en "Historias felices". Eso no es caducidad, es el final
-- feliz de la búsqueda, y ese filtro se aplica al consultar (js/data.js), no
-- tocando la base.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'caducar-inactivos') then
    perform cron.unschedule('caducar-inactivos');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Comprobación: no debe quedar ninguna fila.
-- ---------------------------------------------------------------------------
select jobname, schedule, command from cron.job where jobname = 'caducar-inactivos';

-- ---------------------------------------------------------------------------
-- Lo que la tarea alcanzó a ocultar sigue guardado, en 'archivado'. No se
-- devuelve al mapa en bloque a propósito: desde acá no hay forma de distinguir
-- lo que ocultó la tarea de lo que ocultó el equipo a mano (spam, duplicados).
-- Se revisa uno por uno en la Papelera de la aplicación y se decide cuál vuelve.
--
-- Para ver cuántos hay, desde el panel de Supabase:
--   select count(*) from public.reports where lifecycle = 'archivado';
-- ---------------------------------------------------------------------------
