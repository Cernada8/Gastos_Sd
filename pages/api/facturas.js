// API Route: /api/facturas
// GET    — listar facturas (con filtros opcionales)
// POST   — crear factura (requiere sesión de empleado)
// PUT    — actualizar factura (requiere sesión de admin)
// DELETE — eliminar factura + archivo de Storage (requiere admin)

import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

// Verificar sesión del usuario desde el token Authorization
async function getUsuarioDesdeToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  if (error || !user) return null;
  // Obtener rol
  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('role, nombre')
    .eq('id', user.id)
    .single();
  return { ...user, perfil };
}

export default async function handler(req, res) {
  // ── GET — listar facturas ────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { desde, hasta, empleado_id, proveedor, id } = req.query;

      // Si piden una factura concreta
      if (id) {
        const { data, error } = await supabaseAdmin
          .from('facturas').select('*').eq('id', id).single();
        if (error) return res.status(404).json({ error: 'Factura no encontrada' });
        return res.status(200).json(data);
      }

      let q = supabaseAdmin.from('facturas').select('*').order('created_at', { ascending: false });
      if (desde)       q = q.gte('fecha_factura', desde);
      if (hasta)       q = q.lte('fecha_factura', hasta);
      if (empleado_id) q = q.eq('empleado_id', empleado_id);
      if (proveedor)   q = q.ilike('proveedor', `%${proveedor}%`);

      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PUT — actualizar factura ─────────────────────────────
  if (req.method === 'PUT') {
    const usuario = await getUsuarioDesdeToken(req);
    if (!usuario || usuario.perfil?.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado. Se requiere rol admin.' });
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Falta el parámetro id' });

    const {
      fecha_factura, proveedor, numero_factura,
      base_imponible, iva_porcentaje, iva_importe, total,
    } = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from('facturas')
        .update({ fecha_factura, proveedor, numero_factura, base_imponible, iva_porcentaje, iva_importe, total })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE — eliminar factura ────────────────────────────
  if (req.method === 'DELETE') {
    const usuario = await getUsuarioDesdeToken(req);
    if (!usuario || usuario.perfil?.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado. Se requiere rol admin.' });
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Falta el parámetro id' });

    try {
      // Obtener URL del archivo para borrarlo de Storage
      const { data: factura } = await supabaseAdmin
        .from('facturas').select('archivo_url, archivo_nombre').eq('id', id).single();

      // Borrar de la BD
      const { error } = await supabaseAdmin.from('facturas').delete().eq('id', id);
      if (error) throw error;

      // Intentar borrar el archivo de Storage (no falla si no existe)
      if (factura?.archivo_url) {
        // Extraer la ruta relativa del bucket desde la URL pública
        const urlObj = new URL(factura.archivo_url);
        // La ruta tiene el formato: /storage/v1/object/public/facturas/RUTA
        const pathParts = urlObj.pathname.split('/storage/v1/object/public/Facturas/');
        if (pathParts[1]) {
          await supabaseAdmin.storage.from('Facturas').remove([decodeURIComponent(pathParts[1])]);
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
