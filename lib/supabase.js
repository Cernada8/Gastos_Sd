// Cliente Supabase para el FRONTEND
// Usa las claves públicas (NEXT_PUBLIC_*)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Helpers de Auth ─────────────────────────────────────────

/** Obtiene el usuario activo y su perfil (con rol) */
export async function getUsuarioActivo() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { ...user, perfil };
}

/** Cierra sesión */
export async function cerrarSesion() {
  await supabase.auth.signOut();
}
