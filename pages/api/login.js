// API Route: POST /api/login
// Permite hacer login con NOMBRE (no email) + contraseña
// El backend busca el email en la tabla perfiles y hace el auth internamente

import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { nombre, password } = req.body;

  if (!nombre?.trim() || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña son obligatorios' });
  }

  // 1. Buscar el email asociado al nombre (case-insensitive)
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('perfiles')
    .select('email, role, nombre')
    .ilike('nombre', nombre.trim())
    .single();

  if (perfilError || !perfil) {
    return res.status(401).json({ error: 'Nombre de usuario no encontrado' });
  }

  // 2. Hacer login con Supabase Auth usando el email real
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: perfil.email,
    password,
  });

  if (authError) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  // 3. Devolver sesión + rol para que el frontend redirija correctamente
  return res.status(200).json({
    session: data.session,
    user:    data.user,
    role:    perfil.role,
    nombre:  perfil.nombre,
  });
}
