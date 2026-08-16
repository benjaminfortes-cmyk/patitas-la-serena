// Cliente Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isConfigured =
  !SUPABASE_URL.includes('TU-PROYECTO') &&
  !SUPABASE_ANON_KEY.includes('TU_ANON');

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
