-- ============================================================
-- GASTOS APP SD — Supabase Schema
-- Ejecutar este SQL en el SQL Editor de Supabase
-- ============================================================

-- 1. Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLA PERFILES (roles de usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
  id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'empleado'
                          CHECK (role IN ('admin', 'empleado')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABLA FACTURAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.facturas (
  id               UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  fecha_factura    DATE        NOT NULL,
  proveedor        TEXT        NOT NULL,
  numero_factura   TEXT        NOT NULL,
  base_imponible   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  iva_porcentaje   NUMERIC(5,  2) NOT NULL DEFAULT 21,
  iva_importe      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  empleado_id      UUID        REFERENCES auth.users(id) NOT NULL,
  empleado_nombre  TEXT        NOT NULL,
  archivo_url      TEXT,
  archivo_nombre   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.perfiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas  ENABLE ROW LEVEL SECURITY;

-- ---------- PERFILES ----------
-- Cada usuario puede leer y actualizar su propio perfil
CREATE POLICY "perfil_select_own" ON public.perfiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "perfil_update_own" ON public.perfiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin puede leer todos los perfiles
CREATE POLICY "perfil_select_admin" ON public.perfiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------- FACTURAS — EMPLEADO ----------
CREATE POLICY "factura_select_own" ON public.facturas
  FOR SELECT USING (auth.uid() = empleado_id);

CREATE POLICY "factura_insert_own" ON public.facturas
  FOR INSERT WITH CHECK (auth.uid() = empleado_id);

-- ---------- FACTURAS — ADMIN ----------
CREATE POLICY "factura_select_admin" ON public.facturas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "factura_update_admin" ON public.facturas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "factura_delete_admin" ON public.facturas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 5. TRIGGER: crear perfil automáticamente al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'empleado')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Asegurarse de no duplicar el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. STORAGE BUCKET (ejecutar desde Storage > Buckets en UI,
--    o con estos SQL si tienes permiso sobre storage)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('facturas', 'facturas', true)
-- ON CONFLICT (id) DO NOTHING;

-- Política de storage: empleados suben sus propios archivos
-- CREATE POLICY "storage_insert_authenticated" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'facturas' AND auth.role() = 'authenticated'
--   );

-- Política de storage: lectura pública (URLs firmadas o públicas)
-- CREATE POLICY "storage_select_public" ON storage.objects
--   FOR SELECT USING (bucket_id = 'facturas');

-- Política de storage: admin puede borrar
-- CREATE POLICY "storage_delete_admin" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'facturas' AND
--     EXISTS (
--       SELECT 1 FROM public.perfiles p
--       WHERE p.id = auth.uid() AND p.role = 'admin'
--     )
--   );

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================
