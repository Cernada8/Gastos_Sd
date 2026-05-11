# Gastos App SD

Aplicación web interna para la gestión de facturas de gastos empresariales.

**Stack**: Next.js · Supabase (PostgreSQL + Storage + Auth) · Claude API (visión) · ExcelJS · Vercel

---

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto.
2. Anota la **URL del proyecto** y las claves **anon** y **service_role** desde `Settings → API`.
3. En el menú lateral, ve a **SQL Editor** y ejecuta el contenido completo del archivo `supabase-schema.sql`.
4. Ve a **Storage → Buckets** y crea un bucket llamado `facturas` con acceso **público** (Public bucket: ON).
5. En el bucket `facturas`, configura estas políticas de Storage:
   - `INSERT`: autenticado (`auth.role() = 'authenticated'`)
   - `SELECT`: público (`true`)
   - `DELETE`: solo admin (ver comentarios en `supabase-schema.sql`)

---

## 2. Crear el primer usuario admin

Hay dos formas:

### Opción A — Desde el dashboard de Supabase (recomendado)
1. Ve a **Authentication → Users** en tu proyecto Supabase.
2. Haz clic en **Add user** e introduce email y contraseña.
3. Una vez creado, ve a **Table Editor → perfiles**.
4. Busca el usuario y cambia el campo `role` de `empleado` a `admin`.

### Opción B — Desde SQL Editor
```sql
-- Primero registra el usuario desde la UI, luego ejecuta:
UPDATE public.perfiles
SET role = 'admin'
WHERE email = 'admin@tuempresa.com';
```

### Crear usuarios empleado con metadata de nombre
```sql
-- Para crear un usuario con nombre personalizado, usa la función de Supabase Auth
-- o crea el usuario desde la UI y luego actualiza el perfil:
UPDATE public.perfiles
SET nombre = 'Nombre Apellido'
WHERE email = 'empleado@tuempresa.com';
```

---

## 3. Configurar variables de entorno en Vercel

En el panel de tu proyecto en [vercel.com](https://vercel.com), ve a **Settings → Environment Variables** y añade:

| Variable | Descripción | Dónde encontrarla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (secreta) | Supabase → Settings → API |
| `ANTHROPIC_API_KEY` | Clave de API de Anthropic | console.anthropic.com |

> ⚠️ La `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY` son secretas. Nunca las expongas en el frontend.

Para desarrollo local, copia `.env.local` y rellena los valores reales.

---

## 4. Primer despliegue en Vercel

### Opción A — Desde la CLI de Vercel
```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Desde la carpeta del proyecto:
npm install         # instalar dependencias
vercel              # seguir el asistente interactivo
vercel --prod       # despliegue a producción
```

### Opción B — Desde GitHub (recomendado)
1. Sube el proyecto a un repositorio de GitHub.
2. Ve a [vercel.com/new](https://vercel.com/new) e importa el repositorio.
3. Configura las variables de entorno durante el proceso de importación.
4. Haz clic en **Deploy**.

---

## 5. Estructura del proyecto

```
/
├── pages/
│   ├── index.js              ← Login
│   ├── dashboard.js          ← Vista admin (bento grid)
│   ├── subir.js              ← Vista empleado (subir facturas)
│   ├── _app.js
│   ├── _document.js          ← Tailwind CDN + Chart.js + Inter
│   └── api/
│       ├── extraer-factura.js  ← Claude API vision
│       ├── exportar-excel.js   ← Generación .xlsx con ExcelJS
│       └── facturas.js         ← CRUD contra Supabase
├── lib/
│   ├── supabase.js           ← Cliente frontend (anon key)
│   └── supabaseAdmin.js      ← Cliente backend (service role key)
├── styles/
│   └── globals.css
├── public/
│   └── logo.png              ← Añadir el logo aquí
├── .env.local                ← Variables de entorno (no subir a Git)
├── next.config.js
├── package.json
└── supabase-schema.sql       ← SQL para crear tablas y políticas RLS
```

---

## 6. Flujo de la aplicación

```
Login (/) ──► rol admin  ──► Dashboard (/dashboard)
           └► rol empleado ──► Subir factura (/subir)
```

### Vista Empleado
1. Sube JPG, PNG, WEBP o PDF (máx 10 MB)
2. Claude extrae automáticamente: fecha, proveedor, nº factura, base, IVA y total
3. El empleado revisa y corrige los datos si es necesario
4. Al guardar: el archivo va a Supabase Storage y los datos a la base de datos

### Vista Admin
- **KPIs**: gasto total, nº facturas, IVA soportado, última factura
- **Gráficos**: gastos por mes (barras) + top 5 proveedores (donut)
- **Filtros**: rango de fechas, empleado, proveedor
- **Tabla**: todas las facturas con acciones (ver, editar, eliminar)
- **Excel**: exporta los datos filtrados como `.xlsx` con formato corporativo

---

## 7. Desarrollo local

```bash
# Clonar e instalar
git clone <repo>
cd gastos-app-sd
npm install

# Configurar variables de entorno
cp .env.local .env.local.example
# Editar .env.local con tus claves reales

# Arrancar en modo desarrollo
npm run dev
# → http://localhost:3000
```

---

## 8. Notas técnicas

- **Autenticación**: Supabase Auth con JWT. Los tokens se verifican en las API Routes con el cliente anon del usuario.
- **RLS**: Las políticas de Row Level Security en Supabase garantizan que cada empleado solo ve sus propias facturas. El admin accede a todo mediante el cliente con service role en el servidor.
- **Claude**: El modelo `claude-sonnet-4-20250514` procesa imágenes y PDFs directamente via base64. La llamada siempre se hace desde el servidor (API Route), nunca desde el navegador.
- **Excel**: `exceljs` genera el `.xlsx` en memoria (buffer) y lo devuelve como stream. No se escriben archivos temporales en disco.
- **Vercel**: Compatible al 100%. Sin archivos locales, sin SQLite, todo en la nube.
