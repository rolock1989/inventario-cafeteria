# Inventario Cafe

Aplicacion web para que una cafeteria registre semanalmente su inventario fisico, lo compare con el stock informado por FUDO y conserve un historial de diferencias por producto, usuario y turno.

La app usa Supabase para base de datos y Supabase Auth para login real con email y contrasena.

## Tecnologias usadas

- Next.js 14 con App Router
- React 18
- TypeScript
- CSS global sin framework pesado
- Supabase JS para base de datos
- Supabase Auth para sesiones y contrasenas
- XLSX para exportar inventarios a Excel
- Lucide React para iconos

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
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` es privada. No debe tener prefijo `NEXT_PUBLIC_` y no debe usarse en componentes cliente. La app la usa solo en API routes para crear usuarios en Supabase Auth y cambiar contrasenas.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Activa Email/Password en Authentication.
3. Ve a SQL Editor.
4. Ejecuta `supabase/schema.sql`.
5. Copia `Project URL`, `anon public key` y `service_role key` en `.env.local`.
6. Crea el primer usuario admin en Supabase Auth.
7. Inserta manualmente su perfil en `public.profiles` usando el mismo `id` del usuario Auth:

```sql
insert into public.profiles (id, name, email, role, active)
values ('AUTH_USER_ID_AQUI', 'Admin', 'admin@tucafe.cl', 'admin', true);
```

8. Reinicia `npm run dev`.
9. Entra con el email y contrasena del admin.

Si ya tenias una version anterior de la base, revisa `supabase/auth-migration.sql` antes de ejecutar el esquema definitivo.

Para agregar categorias a una base existente, ejecuta `supabase/categories-migration.sql`.

## Tablas

- `profiles`: perfil de app conectado con `auth.users.id`, con nombre, email, rol y estado activo/inactivo.
- `categories`: categorias reutilizables para productos.
- `products`: catalogo administrable de productos.
- `inventory_sessions`: cabecera del inventario enviado.
- `inventory_items`: detalle por producto con diferencia calculada en base de datos.

La app no guarda contrasenas en `profiles`. Las contrasenas quedan administradas por Supabase Auth.

## Seguridad

`supabase/schema.sql` incluye politicas RLS basadas en Supabase Auth:

- Admin puede administrar productos y usuarios.
- Admin puede administrar categorias.
- Trabajador puede ingresar inventarios.
- Trabajador puede ver sus inventarios.
- Admin puede ver todo el historial.
- Usuarios inactivos no pueden operar desde la app.

No expongas claves privadas en Vercel ni en el navegador. Configura `SUPABASE_SERVICE_ROLE_KEY` como variable privada del proyecto.

## Desplegar en Vercel mas adelante

1. Sube el repositorio a GitHub.
2. Crea un nuevo proyecto en Vercel e importa el repositorio.
3. Configura las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Ejecuta el deploy.

Vercel detecta Next.js automaticamente.

## Funcionalidades incluidas

- Login real con email y contrasena usando Supabase Auth.
- Sesion persistente al recargar.
- Cerrar sesion.
- Navegacion diferenciada para admin y trabajador.
- Bloqueo de paginas admin para trabajadores.
- Dashboard con resumen del ultimo inventario guardado.
- Registro de inventario con productos reales desde Supabase.
- Envio de inventario persistente en Supabase.
- CRUD persistente de productos para administradores.
- Administracion de categorias reutilizables para administradores.
- CRUD de usuarios reales de Supabase Auth para administradores.
- Cambio opcional de contrasena sin mostrar contrasenas actuales.
- Confirmacion antes de eliminar productos o usuarios.
- Historial persistente con filtros por fecha y usuario.
- Exportacion Excel de inventarios por rango de fechas.
- Detalle persistente de cada inventario enviado.
- Busqueda y filtro por categoria en ingreso de inventario.
