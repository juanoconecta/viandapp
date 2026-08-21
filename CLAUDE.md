# ViandApp

Marketplace de viandas caseras en Rafaela, Santa Fe. Conecta "vianderas"
(cocineras/productoras caseras) con consumidores del barrio, sin intermediarios.

## Stack

- **Next.js 16** (App Router, TypeScript, React 19)
- **Tailwind CSS v4** — theming vía `tailwind.config.ts` (cargado con `@config` en
  `app/globals.css`) para mantener la sintaxis clásica `theme.extend.colors`
- **Supabase** — Postgres + Auth (auth todavía no implementada, todo público en esta
  primera iteración)
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

## Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

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

## Estado del proyecto

Pivot a landing page (2026-08-20): antes de tener vianderas reales, un mapa vacío
no genera valor. La home ahora es una landing que explica el proyecto y termina en
un formulario que suma interesadas a `interesados_viandera` vía Server Action
(`app/(consumer)/actions.ts`). El mapa/filtros/lista de viandas siguen en el
código (`components/map`, `components/viandas`) para cuando haya datos reales,
pero no se renderizan en la home por ahora. Sin autenticación todavía.
