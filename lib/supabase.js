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

/** Obtiene el usuario activo y su perfil (con rol) via API route con service role */
export async function getUsuarioActivo() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const { user, perfil } = await res.json();
    return { ...user, perfil };
  } catch {
    return null;
  }
}

/** Cierra sesión */
export async function cerrarSesion() {
  await supabase.auth.signOut();
}
