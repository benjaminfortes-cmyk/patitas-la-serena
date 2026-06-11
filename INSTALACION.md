# 🛠️ Guía de instalación y despliegue — Patitas La Serena

Guía paso a paso para pasar del **modo demo** a una app **real en producción**. Tómate tu tiempo; no necesitas instalar casi nada (todo es por navegador, salvo el último paso opcional de push).

> **Resumen de lo que harás:** crear un proyecto Supabase → correr 4 archivos SQL → activar login con Google → pegar 2 claves en `config.js` → publicar el sitio. El push (notificaciones) es un extra opcional al final.

---

## Paso 1 · Crear el proyecto en Supabase

1. Entra a **[supabase.com](https://supabase.com)** y crea una cuenta (puedes usar tu Google).
2. Clic en **New project**.
   - **Name:** `patitas-la-serena`
   - **Database Password:** inventa una y **guárdala** (no la necesitarás seguido, pero anótala).
   - **Region:** elige **South America (São Paulo)** — es la más cercana a Chile.
3. Espera ~2 minutos a que el proyecto termine de crearse.

---

## Paso 2 · Activar las extensiones PostGIS y pg_cron

1. En el menú lateral: **Database → Extensions**.
2. Busca **`postgis`** y actívalo (toggle).
3. Busca **`pg_cron`** y actívalo.

> Estas dos son la base de los mapas geográficos y las tareas programadas.

---

## Paso 3 · Crear toda la base de datos (los 4 SQL)

1. En el menú lateral: **SQL Editor → New query**.
2. Abre el archivo **`supabase/migrations/0001_init.sql`** de este proyecto, **copia todo** su contenido, pégalo en el editor y presiona **Run** ▶️.
3. Repite lo mismo, **en orden**, con:
   - `supabase/migrations/0002_views.sql`
   - `supabase/migrations/0003_storage.sql`
   - `supabase/migrations/0004_alerts.sql`

Cada uno debería decir **"Success"**. Con esto quedan creadas las tablas, la seguridad (RLS), las funciones, el bucket de fotos y las tareas programadas.

> Si `0001` reclama por una extensión, vuelve al Paso 2.

---

## Paso 4 · Activar el login con Google

Necesitas credenciales de Google + activarlas en Supabase.

### 4a. Crear credenciales en Google
1. Ve a **[console.cloud.google.com](https://console.cloud.google.com)** → crea un proyecto (o usa uno).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: configúrala como **Externa**, pon el nombre de la app y tu correo.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
   - Tipo: **Aplicación web**.
   - En **URIs de redireccionamiento autorizados**, agrega:
     ```
     https://TU-PROYECTO.supabase.co/auth/v1/callback
     ```
     (Reemplaza `TU-PROYECTO` por el de tu proyecto; lo ves en la URL de Supabase.)
4. Copia el **Client ID** y el **Client Secret**.

### 4b. Activarlo en Supabase
1. En Supabase: **Authentication → Providers → Google** → actívalo.
2. Pega el **Client ID** y **Client Secret** → **Save**.
3. En **Authentication → URL Configuration**:
   - **Site URL:** la dirección donde publicarás (ej: `https://patitas.vercel.app`). Por ahora puedes poner `http://localhost:5500`.
   - **Redirect URLs:** agrega tanto `http://localhost:5500` como tu dirección de producción.

---

## Paso 5 · Conectar el frontend (las 2 claves)

1. En Supabase: **Project Settings → API**. Verás:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public** key (una clave larga)
2. Abre **`js/config.js`** y reemplaza:
   ```js
   export const SUPABASE_URL = 'https://abcd1234.supabase.co';      // tu Project URL
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';                 // tu anon public key
   ```

> Estas claves son **públicas** y seguras de exponer: la seguridad real la dan las políticas RLS. La clave **service_role** NUNCA va aquí ni en el repositorio.

¡Listo! Apenas guardes esto, la app deja el modo demo y empieza a usar datos reales. Recarga `localhost:5500` y prueba publicar un reporte de verdad.

---

## Paso 6 · Correr en local

No tienes Python, así que usa **Node** (que ya tienes):

```powershell
cd "C:\Users\benja\OneDrive\Escritorio\Nueva carpeta"
npx serve -l 5500 .
```

Abre **http://localhost:5500**. Para detener: `Ctrl + C`.

---

## Paso 7 · Publicar en producción

El sitio es 100% estático, así que cualquiera de estas dos opciones sirve:

### Opción A — Vercel (recomendada, más simple)
1. Crea cuenta en **[vercel.com](https://vercel.com)**.
2. Sube este proyecto a un repositorio de GitHub (o usa `npx vercel` desde la carpeta).
3. **Import Project** → selecciona el repo → **Deploy**. No hay que configurar build (es estático).
4. Te dará una URL tipo `https://patitas-la-serena.vercel.app`.
5. **Vuelve al Paso 4b** y agrega esa URL en *Site URL* y *Redirect URLs* de Supabase.

### Opción B — GitHub Pages
1. Sube el proyecto a un repo público de GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Te dará una URL tipo `https://tuusuario.github.io/patitas-la-serena/`.
4. Agrega esa URL en Supabase (Paso 4b).

> Las rutas del proyecto son **relativas**, así que funciona igual en la raíz (Vercel) o en un subpath (GitHub Pages).

---

## Paso 8 · Crear tu usuario administrador

Para poder moderar (ver reportes ocultados por denuncias, borrar, etc.):

1. Entra a la app **con Google al menos una vez** (esto crea tu perfil).
2. En Supabase: **Authentication → Users**, copia tu **User UID**.
3. **SQL Editor**, ejecuta (reemplaza el UID):
   ```sql
   update public.profiles set role = 'admin'
   where id = 'TU-USER-UID';
   ```

Como admin, tu sesión ve también los reportes archivados/denunciados. Para revisar la cola de moderación puedes consultar:
```sql
-- Reportes ocultados por denuncias (3+)
select * from public.reports where lifecycle = 'archivado' and flags_count >= 3;
-- Detalle de las denuncias
select * from public.flags order by created_at desc;
```

---

## Paso 9 · (Opcional) Notificaciones push reales

Esto es lo único que requiere descargar el **Supabase CLI**. Si no lo haces, todo lo demás funciona; solo no llegarán las alertas automáticas.

### 9a. Generar las claves VAPID
```powershell
npx web-push generate-vapid-keys
```
Te dará una **Public Key** y una **Private Key**.
- Pega la **pública** en `js/config.js` → `VAPID_PUBLIC_KEY`.

### 9b. Instalar el CLI y desplegar la función
```powershell
npm install -g supabase
supabase login
supabase link --project-ref TU-PROYECTO
supabase functions deploy send-push
```

### 9c. Cargar los secretos de la función
```powershell
supabase secrets set VAPID_PUBLIC_KEY="tu-clave-publica" VAPID_PRIVATE_KEY="tu-clave-privada" VAPID_SUBJECT="mailto:tu-correo@ejemplo.cl" WEBHOOK_SECRET="un-texto-largo-aleatorio"
```
> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente; no hay que cargarlos.
> `WEBHOOK_SECRET` es un texto inventado por ti (largo y aleatorio); evita que extraños disparen la función y manden notificaciones falsas.

### 9d. Conectar el webhook (que se dispare al publicar)
1. En Supabase: **Database → Webhooks → Create a new hook**.
2. **Name:** `notificar-reporte` · **Table:** `reports` · **Events:** marca solo **Insert**.
3. **Type:** *Supabase Edge Functions* → selecciona **send-push**.
4. En **HTTP Headers** agrega: nombre `x-webhook-secret`, valor el mismo `WEBHOOK_SECRET` del paso 9c.
5. **Create**.

Desde ahora, cada reporte nuevo dispara la función, que avisa por push a quienes tengan una zona de alerta dentro del radio. 🎉

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Ningún botón hace nada / pantalla en blanco | Abriste el archivo directo (`file://`) | Ábrelo por `http://localhost:5500` (Paso 6) |
| Sigue en "modo demo" | `config.js` con valores de ejemplo, o caché vieja | Revisa el Paso 5 y haz `Ctrl + Shift + R` |
| Login con Google falla | Redirect URL mal configurada | Revisa Paso 4 (la URL exacta `.../auth/v1/callback`) |
| No suben las fotos | No corriste `0003_storage.sql` | Vuelve al Paso 3 |
| No llegan las push | Falta el webhook o los secretos | Revisa Pasos 9c y 9d |

---

¿Dudas? Cada paso es independiente: puedes tener la app funcionando con datos reales (Pasos 1–7) y dejar el push (Paso 9) para después.
