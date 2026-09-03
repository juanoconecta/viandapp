# ViandApp

Marketplace de viandas caseras en Rafaela, Santa Fe. Conecta "vianderas"
(cocineras/productoras caseras) con consumidores del barrio, sin intermediarios.

## Stack

- **Next.js 16** (App Router, TypeScript, React 19)
- **Tailwind CSS v4** — theming vía `tailwind.config.ts` (cargado con `@config` en
  `app/globals.css`) para mantener la sintaxis clásica `theme.extend.colors`
- **Supabase** — Postgres + Auth (email/password y Google OAuth, gatean la ruta
  `/app` vía `middleware.ts`; la landing en `/` sigue pública)
- **MapLibre GL JS** — mapa de vianderas, siempre como Client Component. Tiles
  raster de OpenStreetMap (`tile.openstreetmap.org`), gratis y sin necesidad de
  token ni cuenta. Ver nota de Turbopack más abajo para el motivo de usar raster
  en vez de un estilo vectorial
- **`motion`** (ex Framer Motion) — animaciones de entrada y scroll-reveal en la
  landing (`components/landing/Reveal.tsx`, `TarjetasVianda.tsx`)

## Sistema de diseño

Dirección "cuaderno de la vecina": cálido y casero, no la estética genérica de
landing (crema + serif editorial + acento terracota).

- **Color**: `paper` (`#FBF2E4`, fondo cálido tipo papel), `ink` (`#362417`, texto,
  marrón cálido en vez de negro puro), `card` (`#FFFCF6`, superficie de tarjetas),
  `coral` (marca, CTAs), `teal` (marca, acentos secundarios), `mostaza`
  (`#E8A93D`, dorado cálido — usar con moderación, es un acento terciario).
  Todo definido en `tailwind.config.ts`.
- **Tipografía**: `Baloo 2` (display, redondeada y cercana — títulos únicamente,
  vía `font-display`) + `Inter` (texto, vía `font-sans`), cargadas con
  `next/font/google` en `app/layout.tsx`.
- **Firma visual**: pila de "tarjetas de vianda" rotadas en el hero
  (`TarjetasVianda.tsx`) — simula etiquetas/tarjetas escritas a mano en vez de
  una foto de stock.
- **Íconos**: SVG de línea propios en `components/landing/icons.tsx` (stroke
  `currentColor`, `strokeWidth` 1.75, puntas redondeadas). No usar emoji como
  ícono — es uno de los patrones más reconocibles de diseño genérico/generado
  por IA; si hace falta un ícono nuevo, agregarlo ahí siguiendo el mismo estilo.
- Evitar repetir la misma forma de sección dos veces seguidas (ej. dos grids de
  3 columnas con ícono+título+texto una debajo de la otra) — rompe la
  variación y se siente templated. Ver `¿Cómo funciona?` (grid numerado, es
  una secuencia real) vs `¿Por qué sumarte?` (lista de filas) en la home.
- Todo elemento clickeable/táctil apunta a >=44px de alto (botones, links de
  nav, inputs) salvo el isotipo del logo.
- Los números en "¿Cómo funciona?" son válidos (es una secuencia real de 3
  pasos); no agregar numeración decorativa en secciones que no sean procesos.

## Convenciones de código

- Server Components por defecto. Marcar `'use client'` solo en componentes que
  necesiten interactividad, estado, o libs de navegador (mapas, formularios).
- Componentes agrupados por dominio: `components/layout`, `components/map`,
  `components/viandas`.
- Rutas de consumidor bajo el route group `app/(consumer)`.
- Paleta de marca: `coral` (`#D85A30`, acento principal — logo, CTAs) y `teal`
  (`#1F6F6B`, acento secundario), definidos en `tailwind.config.ts`.
- Textos de interfaz en español (es-AR), tono cercano/local.
- Componentes de mapa (MapLibre GL) se importan siempre con `next/dynamic` y
  `{ ssr: false }` desde el Server Component padre, porque MapLibre GL accede a
  `window`/`document` y rompe en SSR. En Next.js 16, `ssr: false` no se permite
  directo en un Server Component: el `dynamic()` vive en un wrapper `'use client'`
  (`ViandaMapLoader.tsx`) que el Server Component importa normalmente.
- **`npm run dev` usa `next dev --webpack`, no Turbopack.** Turbopack tiene un bug
  confirmado ([vercel/next.js#86495](https://github.com/vercel/next.js/issues/86495))
  donde el worker de MapLibre GL pierde su chunk hermano en dev y el mapa nunca
  termina de cargar el estilo. Como mitigación adicional, `ViandaMap.tsx` también
  sirve el worker de MapLibre como asset estático desde `public/` (copiado de
  `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` y `-shared.mjs`) vía
  `setWorkerUrl()`, y usa un estilo raster (sin capas vectoriales) para no depender
  del worker para parsear tiles. Si en el futuro se actualiza Next.js/MapLibre y se
  confirma que el bug está resuelto, se puede volver a `next dev` sin flags y a un
  estilo vectorial.
- **No envolver un `<form action={serverAction}>` con `AnimatePresence
  mode="wait"` / `motion.form`.** Rompe el swap de estado post-submit: el
  `useActionState` sí actualiza (confirmado con logs de servidor), pero la
  animación de salida del form nunca completa y el DOM nunca monta el estado
  siguiente. Si un form necesita animarse, usar `motion` solo en el estado que
  aparece (`initial`/`animate` sin `exit`) y dejar que React swapee el `<form>`
  nativo directo, sin `AnimatePresence` alrededor.
- La lista de palabras reservadas para slugs de viandera
  (`lib/viandera/slug.ts`, `RUTAS_RESERVADAS`) debe reflejar cada ruta que
  exista a nivel raíz de `app/`. Si se agrega una ruta nueva ahí (ej.
  `/vianderas` para una futura página de exploración), sumarla también a
  esa lista.

## Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
```

Las últimas dos son server-only — nunca `NEXT_PUBLIC_`, nunca importadas
desde un archivo `'use client'`. Se usan para el panel de admin (`/admin`)
y el panel de viandera (`/viandera`): invitar cuentas, vincular la cuenta
de una viandera a su fila en `vianderas`, y verificar quién es el admin sin
una tabla de roles.

### Prerrequisitos de Auth (Supabase Dashboard)

- Authentication → Providers → Email → "Confirm email" está OFF por ahora
  (necesario para que el flujo actual de registro-y-redirect funcione sin
  disparar la rama "verificar" todo el tiempo). El spec dice que hay que
  volver a activarlo antes de invitar usuarias reales; `registrarse` en
  `app/auth/actions.ts` ya maneja ambos casos (con y sin sesión post-signup).
- Google OAuth requiere configurar un cliente OAuth en Google Cloud y cargar
  Client ID/Secret + Redirect URLs en el provider de Google del Supabase
  Dashboard — todavía no se hizo en esta branch, así que "Continuar con
  Google" cae en `/login?error=oauth` hasta que se configure. No es un bug
  de código.

## Schema de base de datos (Supabase / Postgres)

Ejecutar en el SQL Editor de Supabase:

```sql
create extension if not exists "pgcrypto";

create table vianderas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  bio text,
  lat double precision,
  lng double precision,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table viandas (
  id uuid primary key default gen_random_uuid(),
  vianderas_id uuid not null references vianderas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric,
  tipo text not null check (tipo in ('almuerzo', 'cena', 'ambos')),
  foto_url text,
  disponible boolean not null default true,
  created_at timestamptz not null default now()
);

create table interesados_viandera (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text not null,
  zona text,
  instagram text,
  mensaje text,
  created_at timestamptz not null default now()
);

alter table vianderas enable row level security;
alter table viandas enable row level security;
alter table interesados_viandera enable row level security;

create policy "vianderas activas son publicas"
  on vianderas for select
  using (activo = true);

create policy "viandas disponibles son publicas"
  on viandas for select
  using (disponible = true);

create policy "cualquiera puede anotarse como interesada"
  on interesados_viandera for insert
  to anon
  with check (true);
```

`tipo` en `viandas` modela el filtro de la home: **Almuerzo**, **Cena** o **Ambos**.
`interesados_viandera` es la lista de espera de la landing: sin policy de `select`
para `anon` a propósito (los leads solo se ven desde el dashboard de Supabase con
la cuenta del proyecto), solo `insert` público vía el formulario.

Agregado para el panel de viandera (altas/ediciones desde `/viandera`,
invitaciones desde `/admin`):

```sql
alter table vianderas
  add column user_id uuid references auth.users(id) unique;

create policy "viandera ve su propia fila"
  on vianderas for select
  using (auth.uid() = user_id);

create policy "viandera edita su propia fila"
  on vianderas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "viandera ve sus propios platos"
  on viandas for select
  using (
    vianderas_id in (select id from vianderas where user_id = auth.uid())
  );

create policy "viandera administra sus propios platos"
  on viandas for all
  using (
    vianderas_id in (select id from vianderas where user_id = auth.uid())
  )
  with check (
    vianderas_id in (select id from vianderas where user_id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('platos', 'platos', true);

create policy "cualquiera lee fotos de platos"
  on storage.objects for select
  using (bucket_id = 'platos');

create policy "viandera sube fotos a su propia carpeta"
  on storage.objects for insert
  with check (
    bucket_id = 'platos'
    and (storage.foldername(name))[1] in (
      select id::text from vianderas where user_id = auth.uid()
    )
  );

create policy "viandera borra fotos de su propia carpeta"
  on storage.objects for delete
  using (
    bucket_id = 'platos'
    and (storage.foldername(name))[1] in (
      select id::text from vianderas where user_id = auth.uid()
    )
  );
```

Agregado para la vidriera pública de la viandera (`/{slug}`):

```sql
alter table vianderas
  add column slug text unique;

alter table viandas
  add column etiquetas text[] not null default '{}';
```

Agregado para el explorador de consumidores (`/explorar`), en
`supabase/migrations/202609030001_explorador_mvp.sql` — **archivo creado en
este repo, todavía no aplicado en el Supabase de producción** (pendiente de
ejecutarlo manualmente en el SQL Editor y confirmarlo antes de dar por
migrado el entorno real):

- `vianderas.barrio` (text, nullable), `vianderas.ofrece_retiro` (boolean,
  default `true`), `vianderas.ofrece_envio` (boolean, default `false`),
  `vianderas.updated_at` y `viandas.updated_at` (timestamptz, actualizados
  automáticamente por un trigger `viandapp_set_updated_at()` en cada
  `update`, no se setean a mano desde la app).
- Tabla `eventos_analitica` (`id`, `nombre` con `check` a los 7 eventos del
  explorador, `viandera_id`, `vianda_id`, `metadata` jsonb con `check
  (jsonb_typeof(metadata) = 'object')`, `created_at`), con RLS habilitado y
  **sin ninguna policy** — no hay insert público. La escritura solo va a
  poder hacerse server-side con `createAdminClient()` (implementado en una
  tarea posterior del plan del explorador), nunca desde el cliente.

## Estado del proyecto

Pivot a landing page (2026-08-20): antes de tener vianderas reales, un mapa vacío
no genera valor. La home ahora es una landing que explica el proyecto y termina en
un formulario que suma interesadas a `interesados_viandera` vía Server Action
(`app/(consumer)/actions.ts`). El mapa/filtros/lista de viandas siguen en el
código (`components/map`, `components/viandas`) para cuando haya datos reales,
pero no se renderizan en la home por ahora. La ruta `/app` ya existe detrás de
Supabase Auth (email/password + Google OAuth), gateada por `middleware.ts`;
`/` (la landing) sigue pública y sin gate.

Panel de viandera (agregado 2026-08-22): las vianderas invitadas desde
`/admin` ya no se cargan a mano en el dashboard de Supabase — entran a
`/viandera` con su propia cuenta, editan su perfil (incluida la ubicación
con un pin arrastrable en el mapa) y administran su menú completo, con
fotos reales en Supabase Storage. `/admin` es un panel de un solo admin
(chequeado por `ADMIN_EMAIL`), no un sistema de roles.

Vidriera pública de la viandera (agregado 2026-08-24): cada viandera tiene
una página pública en `viandapp.ar/{slug}` (`app/[slug]/page.tsx`), sin
autenticación, que muestra su perfil y sus platos disponibles — el slug se
genera automáticamente del nombre al invitar o guardar el perfil por
primera vez, y es editable después desde `/viandera/perfil`. Los platos
también tienen etiquetas dietarias (`viandas.etiquetas`, lista fija de 7
valores en `lib/viandera/etiquetas.ts`). El mockup estático "Doña Rosa" en
la landing (`components/landing/PreviewPerfil.tsx`) sigue ahí sin cambios
— es contenido de ejemplo para la landing, no reemplazado por esta
funcionalidad.

Explorador de consumidores en construcción (arrancado 2026-09-03, en curso):
se está implementando `/explorar`, una vidriera pública para que un
consumidor busque viandas por texto/tipo/etiqueta/modalidad sin
registrarse, siguiendo
`docs/superpowers/plans/2026-09-03-viandapp-explorador-mvp-implementation-plan.md`
(spec en `docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md`).
`/` sigue siendo la landing de captación de vianderas — esta entrega no la
reemplaza. Sin mapa, geolocalización, carrito ni checkout en esta primera
vuelta (ver "Siguiente entrega" en el spec). Migración de datos versionada
en `supabase/migrations/`, todavía sin aplicar en producción — no asumir
que las columnas nuevas (`barrio`, `ofrece_retiro`, `ofrece_envio`,
`updated_at`, tabla `eventos_analitica`) ya existen en el Supabase real
hasta confirmarlo.
