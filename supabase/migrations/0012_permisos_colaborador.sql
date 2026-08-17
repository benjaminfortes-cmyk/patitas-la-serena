-- 0012: se acota lo que puede hacer un colaborador.
--
-- La 0011 le dio los mismos permisos del admin. Acá se recortan:
--
--   puede : publicar (firmado con su organización), ocultar cualquier reporte,
--           y editar / resolver / borrar los suyos.
--   no puede : borrar ni editar reportes ajenos, ni confirmar los avisos de
--              "volvió a casa" (eso queda solo para el admin).

-- Ocultar del mapa. Es la única acción del colaborador sobre un reporte ajeno,
-- y por eso pasa por una función: la política de UPDATE ya no se lo permite.
-- Es reversible con reactivate_report().
create or replace function public.archive_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_staff() then
    raise exception 'No tienes permiso para ocultar este reporte.' using errcode = '42501';
  end if;

  update public.reports
     set lifecycle  = 'archivado',
         updated_at = now()
   where id = p_report_id
     and lifecycle <> 'archivado';

  if not found then
    raise exception 'Ese reporte ya estaba oculto.' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.archive_report(uuid) to authenticated;

-- Marcar como resuelto: el dueño y el admin. Un colaborador no cierra la
-- búsqueda de otro.
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

-- Confirmar o rechazar un aviso de reencuentro: solo el admin.
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

-- Editar directo (lo hace el formulario en modo edición): dueño o admin.
drop policy if exists reports_update_owner on public.reports;
create policy reports_update_owner on public.reports
  for update using (user_id = auth.uid() or public.is_admin());

-- Borrar: el admin cualquiera; el colaborador solo lo suyo.
drop policy if exists reports_delete_admin on public.reports;
create policy reports_delete_admin on public.reports
  for delete using (
    public.is_admin() or (public.is_staff() and user_id = auth.uid())
  );

-- reactivate_report() se queda con is_staff(): quien oculta tiene que poder
-- deshacerlo. reports_select_public también, para que vea lo que ocultó.

-- Verificación: en reports_update_owner y en confirm_resolution ya no debe
-- aparecer is_staff.
select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and tablename = 'reports';
