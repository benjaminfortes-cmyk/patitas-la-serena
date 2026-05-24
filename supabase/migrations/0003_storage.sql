-- ============================================================================
-- Storage: bucket de fotos de reportes
--
-- Las fotos se guardan en el bucket `report-photos`, en una carpeta por
-- usuario: {user_id}/{uuid}.jpg. Lectura pública (las fotos se ven en el mapa
-- sin login); subir/borrar solo el dueño dentro de SU carpeta.
-- ============================================================================

-- Crear el bucket público (idempotente)
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

-- Lectura pública de las fotos
create policy "fotos: lectura pública"
  on storage.objects for select
  using (bucket_id = 'report-photos');

-- Subir: solo autenticado y dentro de su propia carpeta {user_id}/...
create policy "fotos: subir propias"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Actualizar: solo las propias
create policy "fotos: actualizar propias"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrar: solo las propias
create policy "fotos: borrar propias"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
