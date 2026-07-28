-- ============================================================================
-- Límites en la subida de fotos y en la edición directa de reportes
--
-- Dos agujeros que quedaron abiertos desde el inicio:
--
-- 1. El bucket `report-photos` se creó sin límite de tamaño ni de tipo de
--    archivo. Cualquiera con una sesión (que la app crea sola) podía subir
--    CUALQUIER archivo de hasta 50 MB a su carpeta, y el bucket es público:
--    servía de hosting gratis para lo que fuera, con una URL del proyecto.
--    Además no hay tope de cantidad —la subida no pasa por create_report()—,
--    así que unos pocos archivos grandes llenaban el gigabyte del plan.
--
-- 2. La política de UPDATE deja al dueño editar su reporte con una consulta
--    directa, saltándose las validaciones de create_report(). Una descripción
--    de 100.000 caracteres pesa en la lista que descargan TODOS los que abren
--    el mapa.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. El bucket solo acepta imágenes, y chicas
-- ---------------------------------------------------------------------------
-- La app ya comprime a ~200 KB antes de subir (WebP o JPEG), así que 3 MB deja
-- margen de sobra para cualquier foto legítima.
update storage.buckets
   set file_size_limit   = 3145728,   -- 3 MB
       allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
 where id = 'report-photos';

-- ---------------------------------------------------------------------------
-- 2. Las validaciones también valen para la edición directa
-- ---------------------------------------------------------------------------
-- Mismas reglas que create_report(), aplicadas por la base de datos pase lo
-- que pase: da igual si el cambio viene del formulario o de alguien llamando
-- a la API a mano.
create or replace function public.validar_reporte()
returns trigger
language plpgsql
as $$
begin
  if new.contact_whatsapp !~ '^\+569[0-9]{8}$' then
    raise exception 'El WhatsApp debe tener formato +569XXXXXXXX.' using errcode = '22023';
  end if;

  if char_length(coalesce(new.description, '')) > 500 then
    raise exception 'La descripción no puede superar 500 caracteres.' using errcode = '22023';
  end if;

  if char_length(coalesce(new.pet_name, '')) > 60
     or char_length(coalesce(new.breed, '')) > 60
     or char_length(coalesce(new.color, '')) > 200
     or char_length(coalesce(new.animal_type_other, '')) > 40 then
    raise exception 'Alguno de los campos supera el largo permitido.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_validar on public.reports;
create trigger reports_validar
  before insert or update on public.reports
  for each row execute function public.validar_reporte();

comment on function public.validar_reporte() is
  'Valida largo de campos y formato de WhatsApp en cada insert/update, incluso si alguien edita saltándose create_report().';
