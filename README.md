# Inventario Cafe

Aplicacion web para que una cafeteria registre semanalmente su inventario fisico, lo compare con el stock informado por FUDO y conserve un historial de diferencias por producto, usuario y turno.

La app ya esta preparada para persistencia real con Supabase. Si las variables de entorno no estan configuradas, usa datos de ejemplo para que el proyecto siga abriendo localmente.

## Tecnologias usadas

- Next.js 14 con App Router
- React 18
- TypeScript
- CSS global sin framework pesado
- Supabase JS para base de datos
- XLSX para exportar inventarios a Excel
- Lucide React para iconos

## Estructura principal

```txt
src/
  app/
    page.tsx
    dashboard/
      page.tsx
      inventario/
      productos/
      historial/
      usuarios/
  components/
  lib/
    repositories.ts
    inventory.ts
    supabase.ts
    types.ts
supabase/
  schema.sql
```

## Instalarlo en Visual Studio Code

1. Abre esta carpeta en Visual Studio Code.
2. Instala Node.js 20 o superior.
3. Abre la terminal integrada.
4. Instala las dependencias:

```bash
npm install
```

## Correr localmente

```bash
npm run dev
```

Luego abre:

```txt
http://localhost:3000
```

Si el puerto 3000 esta ocupado, Next.js usara el siguiente disponible.

## Variables de entorno

Crea o edita `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

No uses la service role key en el frontend. La anon key es publica y debe trabajar junto con Row Level Security.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ve a SQL Editor.
3. Ejecuta el archivo `supabase/schema.sql`.
4. Copia `Project URL` y `anon public key` en `.env.local`.
5. Reinicia `npm run dev`.

El SQL crea estas tablas:

- `profiles`: usuarios operativos con nombre, email, rol, turno y estado activo/inactivo.
- `products`: catalogo administrable de productos.
- `inventory_sessions`: cabecera del inventario enviado.
- `inventory_items`: detalle por producto con diferencia calculada en base de datos.

La version actual no guarda contrasenas. Los usuarios de la app se administran en `profiles` y la columna `auth_user_id` queda lista para enlazar Supabase Auth mas adelante.

## Seguridad

El archivo `supabase/schema.sql` incluye politicas demo para permitir persistencia usando la anon key mientras no exista Supabase Auth real. Antes de produccion, reemplaza esas politicas por reglas basadas en usuarios autenticados y roles admin/trabajador.

No expongas claves privadas en Vercel ni en el navegador. Si mas adelante necesitas crear usuarios reales de Supabase Auth desde la app, hazlo mediante una API Route del servidor usando una variable privada, nunca desde componentes cliente.

## Desplegar en Vercel mas adelante

1. Sube el repositorio a GitHub.
2. Crea un nuevo proyecto en Vercel e importa el repositorio.
3. Configura las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Ejecuta el deploy.

Vercel detecta Next.js automaticamente.

## Funcionalidades incluidas

- Login operativo por seleccion de usuario activo.
- Navegacion diferenciada para admin y trabajador.
- Dashboard con resumen del ultimo inventario guardado.
- Registro de inventario con productos reales desde Supabase.
- Envio de inventario persistente en Supabase.
- CRUD persistente de productos para administradores.
- CRUD persistente de usuarios operativos para administradores.
- Confirmacion antes de eliminar productos o usuarios.
- Historial persistente con filtros por fecha y usuario.
- Exportacion Excel de inventarios por rango de fechas.
- Detalle persistente de cada inventario enviado.
- Busqueda y filtro por categoria en ingreso de inventario.
