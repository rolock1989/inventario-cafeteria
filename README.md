# Inventario Cafe

Aplicacion web para que una cafeteria registre semanalmente su inventario fisico, lo compare con el stock informado por FUDO y conserve un historial de diferencias por producto, usuario y turno.

La primera version usa datos de ejemplo y estado local para permitir probar el flujo completo. La estructura ya queda preparada para conectar Supabase Auth y PostgreSQL sin rehacer las pantallas.

## Tecnologias usadas

- Next.js 14 con App Router
- React 18
- TypeScript
- CSS global sin framework pesado
- Supabase JS preparado para autenticacion y base de datos
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
    inventory.ts
    mock-data.ts
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

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Luego abre:

```txt
http://localhost:3000
```

Usuarios demo disponibles en la pantalla de login:

- `admin@inventariocafe.cl`
- `trabajador@inventariocafe.cl`

## Variables de entorno

El proyecto usa `.env.local` para desarrollo local:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_USE_MOCKS=true
```

Cuando conectes Supabase, completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Mantén `NEXT_PUBLIC_USE_MOCKS=true` mientras trabajes con datos de ejemplo y cambia a `false` cuando implementes los repositorios reales.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ve a SQL Editor.
3. Ejecuta el archivo `supabase/schema.sql`.
4. Activa Email/Password en Authentication.
5. Crea usuarios desde Supabase Auth.
6. Inserta un perfil por cada usuario en `public.profiles` usando el mismo `id` de `auth.users`.
7. Carga productos iniciales en `public.products`.

Tablas preparadas:

- `profiles`: usuarios, email, nombre, rol y turno.
- `products`: catalogo administrable de productos.
- `inventories`: cabecera del inventario semanal.
- `inventory_items`: detalle por producto con diferencia calculada en base de datos.

## Desplegar en Vercel mas adelante

1. Sube el repositorio a GitHub.
2. Crea un nuevo proyecto en Vercel e importa el repositorio.
3. Configura las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_USE_MOCKS`
4. Ejecuta el deploy.

Vercel detecta Next.js automaticamente. Para produccion, usa `NEXT_PUBLIC_USE_MOCKS=false` cuando ya esten conectados los servicios reales.

## Funcionalidades incluidas

- Login demo con seleccion de usuario y rol.
- Navegacion diferenciada para admin y trabajador.
- Dashboard con resumen del ultimo inventario.
- Registro de inventario con calculo automatico de diferencias.
- Guardar borrador y enviar inventario en flujo local.
- CRUD local de productos para administradores.
- Historial con filtros por fecha y usuario.
- Exportacion Excel de inventarios por rango de fechas.
- Detalle de cada inventario enviado.
- Busqueda y filtro por categoria en ingreso de inventario.
- Pagina de usuarios preparada para roles reales.
