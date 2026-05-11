// Cliente Supabase ADMIN para el BACKEND (API Routes)
// Usa la Service Role Key — NUNCA importar desde el frontend
import { createClient } from '@supabase/supabase-js';

const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});
