// API Route: GET /api/me
// Devuelve el usuario activo + su perfil (con rol) usando service role
// Evita problemas de RLS al consultar el perfil desde el frontend

import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  // Verificar el token con el cliente anon
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  // Obtener perfil con service role (sin restricciones RLS)
  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return res.status(200).json({ user, perfil });
}
