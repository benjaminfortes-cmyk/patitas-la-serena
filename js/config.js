// ============================================================================
// Configuración pública del cliente
//
// Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con los de tu proyecto
// (Supabase → Project Settings → API). Son PÚBLICOS y seguros de exponer:
// la seguridad real la dan las políticas RLS de la base de datos.
//
// Mientras tengan los valores de ejemplo, la app funciona en MODO DEMO con
// reportes de prueba, para que puedas verla sin configurar el backend.
// ============================================================================

export const SUPABASE_URL = 'https://mjcwccasiiwnziqyksnx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qY3djY2FzaWl3bnppcXlrc254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjA3OTAsImV4cCI6MjA5NTEzNjc5MH0.bRbwcs5zDdJ7OmIsTjaFfWKPQmeyXY07_XnDWe3FqVk';

// Clave pública VAPID para notificaciones push (Etapa 6).
// Genérala con:  npx web-push generate-vapid-keys
// Es PÚBLICA; la privada va solo en los secretos de la Edge Function.
export const VAPID_PUBLIC_KEY = 'BBR5KPyHoCu_s_9NjDUGZmQgLnxWLl3rHE10S5ihEqOelrvSwFp5BiDUKHx71Q8Do1kzCCmgp9TYrX9-jOmyJko';

// La Serena, Chile
export const MAP_CENTER = [-29.9027, -71.2519];
export const MAP_ZOOM = 13;
