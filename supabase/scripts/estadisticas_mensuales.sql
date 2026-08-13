-- ============================================================================
-- Historial mes a mes de Busca Huellitas
--
-- La analítica de visitas (Vercel) solo cuenta desde que se instaló. Esto, en
-- cambio, sale de la base de datos: existe desde el primer reporte publicado.
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo → Run.
-- Devuelve una fila por mes y una última fila TOTAL con el acumulado.
--
-- Nota: el SQL Editor corre con permisos de administrador, así que ve todos
-- los reportes, incluidos los archivados.
-- ============================================================================

with r as (
  select
    -- Los timestamptz se guardan en UTC. Sin convertir a hora de Chile, los
    -- reportes publicados de noche caerían en el mes siguiente.
    to_char(date_trunc('month', created_at at time zone 'America/Santiago'), 'YYYY-MM') as mes,
    kind,
    lifecycle,
    user_id
  from public.reports
)
select
  coalesce(mes, 'TOTAL')                          as periodo,
  count(*)                                        as reportes,
  count(distinct user_id)                         as personas,
  count(*) filter (where kind = 'perdido')        as perdidos,
  count(*) filter (where kind = 'encontrado')     as encontrados,
  count(*) filter (where kind = 'avistado')       as avistados,
  count(*) filter (where lifecycle = 'resuelto')  as reunidos,
  round(
    100.0 * count(*) filter (where lifecycle = 'resuelto') / nullif(count(*), 0),
    1
  )                                               as pct_reunidos
from r
group by rollup (mes)
-- El TOTAL (mes nulo) va al final, no al principio.
order by (mes is null), mes;
