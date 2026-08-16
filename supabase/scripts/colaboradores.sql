-- Dar el perfil de colaborador a una organización.
--
-- Requisito: esa cuenta de Google ya tiene que haber entrado una vez por
-- buscahuellitas.cl/?equipo=1. El nombre es el que se verá en el mapa.
-- Necesita la migración 0011 corrida.

update public.profiles p
set role = 'colaborador',
    org_name = 'Cachupines UCN'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'correo-de-cachupines@gmail.com';

update public.profiles p
set role = 'colaborador',
    org_name = 'Animalba'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'correo-de-animalba@gmail.com';

-- Firma los reportes que la organización haya publicado antes de recibir el perfil.
update public.reports r
set author_org = p.org_name
from public.profiles p
where p.id = r.user_id
  and p.role::text = 'colaborador'
  and p.org_name is not null
  and r.author_org is null;

-- Verificación: una fila por organización.
select u.email, p.role, p.org_name,
       (select count(*) from public.reports r where r.user_id = p.id) as reportes
from public.profiles p
join auth.users u on u.id = p.id
where p.role::text in ('admin', 'colaborador')
order by p.role, u.email;

-- Quitar el perfil:
-- update public.profiles p set role = 'user', org_name = null
-- from auth.users u
-- where u.id = p.id and lower(u.email) = 'correo@gmail.com';
