// ============================================================================
// Cliente Supabase
//
// Si la configuración aún tiene los valores de ejemplo, `isConfigured` es
// false y la app cae en MODO DEMO (datos de prueba en memoria).
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isConfigured =
  !SUPABASE_URL.includes('TU-PROYECTO') &&
  !SUPABASE_ANON_KEY.includes('TU_ANON');

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
