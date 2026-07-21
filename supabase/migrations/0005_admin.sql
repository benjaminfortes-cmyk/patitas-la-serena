-- ----------------------------------------------------------------------------
-- 0005: Rol de administrador
--
-- Desde julio 2026 la app no tiene login público: todo el mundo entra con una
-- sesión anónima. La moderación (archivar / borrar reportes, ver denuncias)
-- sigue exigiendo `profiles.role = 'admin'`, y a esa cuenta se llega por el
-- acceso oculto `?admin=1`, que entra con Google.
--
-- Este script marca como administrador a la cuenta de Google indicada.
-- Requisito: esa cuenta ya debe haber iniciado sesión al menos una vez, para
-- que exista su fila en auth.users y su perfil en public.profiles.
-- ----------------------------------------------------------------------------

update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'benjaminfortes88@gmail.com';

-- Verificación: debe devolver exactamente una fila con role = 'admin'.
select p.id, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
