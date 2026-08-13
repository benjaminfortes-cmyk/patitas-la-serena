-- ============================================================================
-- Refrescar la antigüedad de los reportes (script de mantenimiento)
--
-- NO es una migración: no cambia el esquema, solo mueve fechas de datos ya
-- guardados. Se corre a mano desde el editor SQL de Supabase cuando el mapa
-- se ve "abandonado" porque los reportes de prueba envejecieron.
--
-- Qué hace: calcula un solo desfase (delta) y se lo suma a TODAS las fechas,
-- de manera que el reporte más nuevo pase a tener 1 día de antigüedad y los
-- demás conserven exactamente la misma separación entre sí. Si el más nuevo
-- hoy tiene 12 días y el siguiente 13, después de correr esto tendrán 1 y 2.
--
-- Es seguro repetirlo: si el reporte más nuevo ya tiene menos de un día, no
-- toca nada (nunca envejece los datos, solo los rejuvenece).
-- ============================================================================

do $$
declare
  v_delta interval;
  v_filas int;
begin
  -- Desfase necesario para que el reporte más reciente quede en "hace 1 día".
  select (now() - interval '1 day') - max(created_at)
    into v_delta
    from public.reports;

  if v_delta is null then
    raise notice 'No hay reportes: nada que hacer.';
    return;
  end if;

  if v_delta <= interval '0' then
    raise notice 'El reporte más nuevo ya tiene menos de un día (desfase %). No se toca nada.', v_delta;
    return;
  end if;

  -- least(..., now()) es un cinturón de seguridad: ninguna fecha puede quedar
  -- en el futuro, ni siquiera si algún dato viejo estaba desordenado.
  update public.reports set
    created_at     = least(created_at + v_delta, now()),
    updated_at     = least(updated_at + v_delta, now()),
    event_at       = least(event_at + v_delta, now()),
    last_active_at = least(last_active_at + v_delta, now()),
    resolved_at    = case when resolved_at is null then null
                          else least(resolved_at + v_delta, now()) end;
  get diagnostics v_filas = row_count;
  raise notice 'Reportes movidos % (desfase %).', v_filas, v_delta;

  -- Los avistamientos cuelgan de un reporte: se mueven igual para que no
  -- queden "antes" del reporte al que pertenecen. Va en dinámico y detrás de
  -- un to_regclass porque la migración 0006 no está aplicada en producción:
  -- referenciar la tabla directamente reventaría el bloque entero.
  if to_regclass('public.sightings') is not null then
    execute format(
      'update public.sightings set created_at = least(created_at + %L::interval, now())',
      v_delta
    );
    raise notice 'Avistamientos movidos.';
  else
    raise notice 'La tabla sightings no existe: se omite.';
  end if;
end $$;

-- Comprobación: cómo quedaron los reportes, del más nuevo al más viejo.
select
  pet_name,
  kind,
  lifecycle,
  created_at,
  round(extract(epoch from now() - created_at) / 86400) as dias_de_antiguedad
from public.reports
order by created_at desc;
