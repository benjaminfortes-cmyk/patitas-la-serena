# 🐾 Patitas La Serena

Plataforma centralizada para **reportar y encontrar mascotas perdidas, encontradas y avistadas** en La Serena, Chile. Toda la información en un solo mapa, en vez de dispersa entre Instagram, Facebook, estados de WhatsApp y carteles impresos.

> **Estado:** MVP completo ✅ — las 10 funcionalidades core implementadas.
> Funciona en **modo demo** sin configurar nada; para usar datos reales sigue la **[Guía de instalación](INSTALACION.md)**.

## Funcionalidades

1. 🗺️ **Mapa** con marcadores 🔴 perdido / 🟢 encontrado / 🔵 avistado y *clustering*.
2. 🎛️ **Filtros** por estado, animal y antigüedad + **buscador** por nombre/raza/color.
3. ➕ **Publicar reporte** con foto (comprimida), mini-mapa, geolocalización y validación.
4. 📋 **Ficha** con WhatsApp pre-armado, compartir, denunciar, y editar/resolver del dueño.
5. 🤝 **Matching inteligente** — cruza perdidos ↔ encontrados/avistados (3 km, 30 días).
6. 🧡 **Casos resueltos** — badge "¡Reunidos!" 7 días en el mapa + sección "Historias felices".
7. ⏳ **Caducidad** automática a los 45 días + botón "Sigue activo".
8. 🔐 **Login con Google** (ver el mapa es libre; publicar requiere sesión).
9. 🔔 **Alertas por cercanía** vía Web Push (define zona + radio).
10. 📲 **PWA** instalable y con funcionamiento offline.

Además: **antifraude** (3 reportes/día máx, cola de moderación), **accesibilidad** (teclado, `alt`, contraste) y español de Chile.

> ⚠️ La ubicación que marcas se publica **tal cual** en el mapa. Marca el punto donde se perdió o vio la mascota, no tu casa.

---

## ¿Qué resuelve?

Cuando se te arranca el perro, publicas un reporte **"Perdido"** en el mapa. Quien lo encuentre publica **"Encontrado"** o **"Avistado"**. La plataforma cruza ambos automáticamente por cercanía y tipo de animal, y te avisa de posibles coincidencias. Sin recompensas (atraen estafadores).

## Stack técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | HTML + CSS + JavaScript vanilla (ES modules) | Simple, portable, sin build step |
| Mapa | Leaflet + OpenStreetMap | Gratis, sin API key |
| Backend | **Supabase** (PostgreSQL + PostGIS) | Geo-consultas reales, RLS, cron, full-text — todo gratis al inicio |
| Auth | Supabase Auth con Google | Login de un click, sin costo |
| Push | Web Push API + VAPID (Edge Function) | Notificaciones por zona sin lock-in |
| Hosting | Vercel o GitHub Pages | Frontend 100% estático |

### ¿Por qué Supabase y no Firebase?

Cuatro features centrales lo justifican: **matching por radio** y **alertas por cercanía** usan PostGIS (`ST_DWithin`), la **caducidad/archivado** usa `pg_cron`, los **permisos** usan Row Level Security, y el **buscador** usa full-text de Postgres. En Firebase cada una requeriría workarounds (geohash, Cloud Functions de pago, Algolia). Lo único que cuesta dinero —login por SMS— quedó fuera del MVP a propósito; el MVP usa solo Google.

## Estructura del proyecto

```
patitas-la-serena/         # la raíz ES el sitio (estático)
├─ index.html
├─ manifest.webmanifest     # PWA
├─ sw.js                    # service worker: offline + push
├─ css/styles.css
├─ js/                      # módulos ES (uno por responsabilidad)
│  ├─ app.js                #   orquestador
│  ├─ config.js             #   claves Supabase + VAPID (públicas)
│  ├─ supabase.js  demo.js  data.js
│  ├─ map.js  filters.js  constants.js
│  ├─ auth.js  reportForm.js  reportCard.js
│  ├─ imageCompress.js  storage.js  validation.js
│  ├─ matching.js  historias.js  alerts.js
│  └─ ui.js  pwa.js
├─ assets/                  # íconos PWA (svg normal + maskable)
├─ supabase/
│  ├─ migrations/           # 0001 init · 0002 vistas · 0003 storage · 0004 alertas
│  └─ functions/send-push/  # Edge Function (Deno) para Web Push
├─ INSTALACION.md           # guía paso a paso de setup y deploy
├─ .env.example
└─ README.md
```

## Modelo de datos (resumen)

- **profiles** — usuarios (extiende `auth.users`); rol, bloqueo, denuncias acumuladas.
- **reports** — reportes; tipo (perdido/encontrado/avistado), animal, ubicación exacta marcada por el usuario, foto, WhatsApp, ciclo de vida (activo/resuelto/archivado).
- **flags** — denuncias de info incorrecta/duplicada (cola de moderación).
- **alert_subscriptions** — zonas de alerta por cercanía de cada usuario.
- **push_subscriptions** — endpoints Web Push por dispositivo.

Toda la lógica sensible vive en la base de datos:

- `create_report(...)` aplica el **límite de 3 reportes/día** y valida el WhatsApp chileno.
- `find_matches(...)` cruza reportes opuestos en 3 km / 30 días.
- `mark_resolved`, `reactivate_report`, `flag_report` con control de propiedad vía RLS.
- `pg_cron` archiva resueltos (>7 días) e inactivos (>45 días).

Detalle completo en [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Puesta en marcha

### Ver la app ya mismo (modo demo, sin backend)

```bash
npx serve -l 5500 .
```
Abre **http://localhost:5500**. Trae reportes de prueba para explorar todo.
(En Windows sin Python: usa Node, que ya incluye `npx`.)

> ⚠️ Ábrelo siempre por `http://localhost`, **nunca** haciendo doble clic al `index.html`
> (los módulos JS no cargan con `file://`).

### Pasar a datos reales

Sigue la **[Guía de instalación paso a paso → `INSTALACION.md`](INSTALACION.md)**: crear el proyecto Supabase, correr los 4 SQL, activar Google, pegar las claves y publicar en Vercel o GitHub Pages.

---

Hecho con 🧡 para las mascotas de La Serena.
