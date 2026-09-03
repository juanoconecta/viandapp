# ViandApp Consumer Explorer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar una entrega medible donde una persona explore viandas reales en `/explorar`, abra el perfil público de una viandera y continúe a WhatsApp sin registrarse.

**Architecture:** Se mantiene `/` como landing de captación. `/explorar` será una página pública server-rendered cuyos filtros viven en la URL. Las consultas, el cálculo de filtros y la analítica quedan aislados en `lib/`; los componentes interactivos se limitan a búsqueda, filtros y confirmación de WhatsApp.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase/Postgres, Vitest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md`

## Global Constraints

- Mantener `/` como landing de captación de vianderas.
- Crear `/explorar`; no crear `/explorar/resultados`.
- No implementar mapa, geolocalización, carrito, checkout, pagos, logística, ratings, favoritos ni cuentas de consumidor.
- No usar “Disponible hoy”; el modelo actual no representa días ni horarios.
- No mostrar sellos de identidad, teléfono, carnet o habilitación que no estén respaldados por datos y procesos reales.
- La exploración y los perfiles son públicos y no requieren registro.
- Usar `coral-action` (`#B84826`) cuando haya texto blanco pequeño sobre fondo coral.
- Texto normal: contraste mínimo WCAG 2.2 AA de 4.5:1.
- Mantener `next dev --webpack` y los workers públicos de MapLibre existentes, aunque el mapa no participe de esta entrega.
- No envolver formularios con `AnimatePresence mode="wait"` ni `motion.form`.
- Cada ruta raíz nueva debe agregarse a `RUTAS_RESERVADAS`.
- No registrar PII en analítica: teléfono, dirección, nombre completo, contenido del mensaje ni identificadores de Auth.

---

## File map

### Create

- `docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md`: copia versionada de la especificación aprobada, recortada al MVP.
- `supabase/migrations/202609030001_explorador_mvp.sql`: campos mínimos y tabla de eventos.
- `vitest.config.ts`: configuración de pruebas unitarias.
- `lib/viandas/filtros.ts`: parseo y serialización de filtros públicos.
- `lib/viandas/consultas.ts`: consultas públicas de exploración.
- `lib/analitica/eventos.ts`: nombres, payload permitido y escritura de eventos.
- `app/explorar/page.tsx`: ruta pública de exploración.
- `app/explorar/loading.tsx`: carga estructural.
- `app/explorar/error.tsx`: error recuperable de ruta.
- `components/consumer/ConsumerShell.tsx`: estructura responsive pública.
- `components/consumer/DesktopSidebar.tsx`: navegación desktop.
- `components/consumer/MobileBottomNav.tsx`: navegación mobile.
- `components/consumer/GlobalSearch.tsx`: búsqueda GET sobre `/explorar`.
- `components/consumer/FilterChips.tsx`: filtros básicos en URL.
- `components/consumer/DishCard.tsx`: plato público.
- `components/consumer/EmptyState.tsx`: vacío accionable.
- `components/consumer/ResultsSkeleton.tsx`: carga sin salto de layout.
- `components/storefront/StorefrontHeader.tsx`: cabecera pública factual.
- `components/storefront/PublicDishCard.tsx`: plato dentro de la vidriera.
- `components/storefront/WhatsAppIntent.tsx`: confirmación y salida medida.
- `components/storefront/StickyContactBar.tsx`: CTA mobile contextual.
- `lib/viandas/filtros.test.ts`: pruebas de filtros.
- `lib/analitica/eventos.test.ts`: pruebas de sanitización de eventos.

### Modify

- `package.json`: scripts de Vitest.
- `package-lock.json`: dependencia de desarrollo.
- `tailwind.config.ts`: tokens funcionales accesibles.
- `types/index.ts`: campos nuevos y tabla de eventos.
- `lib/viandera/slug.ts`: reservar `explorar`.
- `app/[slug]/page.tsx`: composición pública rediseñada.
- `CLAUDE.md`: migración y estado actualizado.

### Remove after replacement

- Ningún archivo en esta entrega. Los stubs `components/viandas/Filtros.tsx` y `ViandaList.tsx` se retiran en un commit posterior solo después de verificar que no tengan consumidores.

---

## Task 1: Versionar el diseño aprobado y preparar pruebas

**Files:**

- Create: `docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: script `npm test`, entorno de tests Node y spec estable para el resto del plan.

- [ ] **Step 1: Copiar y recortar la especificación aprobada**

Copiar desde:

```text
C:\Users\ROLE\Documents\Codex\2026-09-02\referenced-chatgpt-conversation-this-is-an\outputs\viandapp-interface-spec.md
```

Excluir mapa de la entrega inicial, pero conservarlo en una sección “Siguiente entrega”. Incorporar literalmente las decisiones de `Global Constraints`.

- [ ] **Step 2: Instalar Vitest**

Run:

```bash
npm install --save-dev vitest
```

- [ ] **Step 3: Crear la configuración**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

Agregar a `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verificar el baseline**

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Expected: los tres comandos pasan antes de cambios funcionales.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md vitest.config.ts package.json package-lock.json
git commit -m "docs: define consumer explorer MVP"
```

---

## Task 2: Migración mínima y tipos

**Files:**

- Create: `supabase/migrations/202609030001_explorador_mvp.sql`
- Modify: `types/index.ts`
- Modify: `CLAUDE.md`

**Interfaces:**

- Produces: `vianderas.barrio`, `ofrece_retiro`, `ofrece_envio`, `updated_at`; `viandas.updated_at`; tabla `eventos_analitica` insert-only.

- [ ] **Step 1: Escribir la migración**

```sql
alter table public.vianderas
  add column if not exists barrio text,
  add column if not exists ofrece_retiro boolean not null default true,
  add column if not exists ofrece_envio boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.viandas
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.viandapp_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vianderas_set_updated_at on public.vianderas;
create trigger vianderas_set_updated_at
before update on public.vianderas
for each row execute function public.viandapp_set_updated_at();

drop trigger if exists viandas_set_updated_at on public.viandas;
create trigger viandas_set_updated_at
before update on public.viandas
for each row execute function public.viandapp_set_updated_at();

create table if not exists public.eventos_analitica (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (nombre in (
    'explore_viewed', 'search_submitted', 'filter_applied',
    'profile_viewed', 'dish_selected', 'whatsapp_intent', 'whatsapp_clicked'
  )),
  viandera_id uuid references public.vianderas(id) on delete set null,
  vianda_id uuid references public.viandas(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint eventos_analitica_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

alter table public.eventos_analitica enable row level security;
```

No crear políticas públicas de inserción. Los eventos se escriben únicamente desde una acción de servidor que usa `createAdminClient()` después de sanitizar el payload. Así un visitante no puede insertar PII o eventos arbitrarios llamando Supabase directamente.

- [ ] **Step 2: Actualizar tipos**

Agregar los campos exactos a `Viandera`, `Vianda` y la definición de `eventos_analitica` en `Database`. Usar un tipo `Json` recursivo compatible con Supabase y `JsonObject` para `EventoAnalitica.metadata`. En los tipos `Insert`, mantener `updated_at` fuera de escritura; modelar como opcionales `barrio`, `ofrece_retiro`, `ofrece_envio` y, para eventos, `viandera_id`, `vianda_id`, `metadata`. Definir:

```ts
export type NombreEventoAnalitica =
  | "explore_viewed"
  | "search_submitted"
  | "filter_applied"
  | "profile_viewed"
  | "dish_selected"
  | "whatsapp_intent"
  | "whatsapp_clicked";
```

- [ ] **Step 3: Documentar aplicación manual**

Agregar a `CLAUDE.md` la ruta de la migración, columnas, constraint de metadata, función `viandapp_set_updated_at()` y ausencia de políticas públicas. No afirmar que producción está migrada hasta verificarlo.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609030001_explorador_mvp.sql types/index.ts CLAUDE.md
git commit -m "feat: add explorer data model and analytics events"
```

---

## Task 3: Filtros públicos puros y testeados

**Files:**

- Create: `lib/viandas/filtros.ts`
- Test: `lib/viandas/filtros.test.ts`

**Interfaces:**

- Produces:

```ts
export type FiltrosExplorador = {
  q: string;
  tipo: "todos" | "almuerzo" | "cena";
  etiqueta: string | null;
  modalidad: "todas" | "retiro" | "envio";
};

export function parsearFiltros(
  params: Record<string, string | string[] | undefined>,
): FiltrosExplorador;
```

- [ ] **Step 1: Escribir pruebas que fallen**

Cubrir valores por defecto, arrays maliciosos, espacios, límite de 80 caracteres, tipo inválido, etiqueta fuera de `ETIQUETAS_DIETARIAS` y modalidad inválida.

```ts
import { describe, expect, it } from "vitest";
import { parsearFiltros } from "./filtros";

describe("parsearFiltros", () => {
  it("devuelve filtros seguros por defecto", () => {
    expect(parsearFiltros({})).toEqual({
      q: "",
      tipo: "todos",
      etiqueta: null,
      modalidad: "todas",
    });
  });

  it("descarta valores no permitidos", () => {
    expect(parsearFiltros({ tipo: "otro", etiqueta: "inventada", modalidad: "dron" }))
      .toEqual({ q: "", tipo: "todos", etiqueta: null, modalidad: "todas" });
  });
});
```

- [ ] **Step 2: Confirmar que fallan**

Run: `npm test -- lib/viandas/filtros.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar el parser mínimo**

Usar listas permitidas; tomar solo el primer valor si llega un array; normalizar `q` con `trim().slice(0, 80)`; no construir consultas en este archivo.

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- lib/viandas/filtros.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/viandas/filtros.ts lib/viandas/filtros.test.ts
git commit -m "feat: add safe explorer filters"
```

---

## Task 4: Analítica segura antes de construir la UI

**Files:**

- Create: `lib/analitica/eventos.ts`
- Test: `lib/analitica/eventos.test.ts`

**Interfaces:**

- Produces:

```ts
export type EventoPublico = {
  nombre: NombreEventoAnalitica;
  vianderaId?: string;
  viandaId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export function sanitizarEvento(evento: EventoPublico): EventoPublico;
export async function registrarEvento(evento: EventoPublico): Promise<void>;
```

- [ ] **Step 1: Escribir pruebas de privacidad que fallen**

```ts
it("elimina metadata sensible", () => {
  expect(sanitizarEvento({
    nombre: "whatsapp_intent",
    metadata: { telefono: "123", mensaje: "hola", origen: "perfil" },
  }).metadata).toEqual({ origen: "perfil" });
});
```

Cubrir claves prohibidas: `telefono`, `phone`, `direccion`, `address`, `nombre`, `email`, `mensaje`, `message`, `user_id`.

- [ ] **Step 2: Confirmar que fallan**

Run: `npm test -- lib/analitica/eventos.test.ts`

- [ ] **Step 3: Implementar sanitización y escritura best-effort**

`lib/analitica/eventos.ts` debe importar `server-only`. `registrarEvento` usa `createAdminClient()`, captura y registra el error en servidor sin bloquear el recorrido del usuario. Limitar metadata a seis claves conocidas y valores escalares con rangos y valores enumerados; nunca aceptar texto libre.

No crear todavía una acción pública (`"use server"`) que exponga `registrarEvento` al cliente: la interfaz no consume analítica en esta tarea, y publicar ese límite de confianza antes de necesitarlo expone un proxy anónimo sin control de costo. La acción (`app/actions/analitica.ts`) se crea recién en la Task 7, junto con una estrategia explícita de limitación de solicitudes y costo, cuando efectivamente haya un componente cliente que necesite dispararla.

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- lib/analitica/eventos.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analitica/eventos.ts lib/analitica/eventos.test.ts
git commit -m "feat: add privacy-safe product analytics"
```

---

## Task 5: Tokens y shell responsive

**Files:**

- Modify: `tailwind.config.ts`
- Create: `components/consumer/ConsumerShell.tsx`
- Create: `components/consumer/DesktopSidebar.tsx`
- Create: `components/consumer/MobileBottomNav.tsx`
- Create: `components/consumer/GlobalSearch.tsx`
- Modify: `lib/viandera/slug.ts`

**Interfaces:**

- Produces:

```ts
export default function ConsumerShell(props: { children: React.ReactNode }): React.ReactNode;
export default function GlobalSearch(props: { initialQuery: string }): React.ReactNode;
```

- [ ] **Step 1: Agregar tokens exactos**

```ts
"ink-muted": "#716255",
line: "#E3D6C7",
"soft-teal": "#EAF4F3",
"soft-coral": "#FCE3D9",
```

Mantener los tokens existentes y usar `coral-600` como `coral-action`; no crear otro hex duplicado.

- [ ] **Step 2: Reservar la ruta**

Agregar `"explorar"` a `RUTAS_RESERVADAS` y una prueba en `slug.test.ts` si se incorpora Vitest a ese helper.

- [ ] **Step 3: Crear navegación semántica**

Desktop: Inicio, Explorar y “Sumar mi cocina”. Mobile: Inicio, Explorar y “Sumar mi cocina”. No mostrar Mapa, Favoritos ni Perfil mientras no existan.

- [ ] **Step 4: Crear búsqueda GET**

El formulario debe enviar `q` a `/explorar`, conservar filtros compatibles y tener label accesible aunque visualmente use placeholder.

- [ ] **Step 5: Verificar responsive**

Comprobar 320, 375, 768, 1024 y 1440 px; sin scroll horizontal; targets de 44 px; foco visible.

- [ ] **Step 6: Validar**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts lib/viandera/slug.ts components/consumer
git commit -m "feat: add responsive consumer shell"
```

---

## Task 6: Consulta pública y `/explorar`

**Files:**

- Create: `lib/viandas/consultas.ts`
- Create: `app/explorar/page.tsx`
- Create: `app/explorar/loading.tsx`
- Create: `app/explorar/error.tsx`
- Create: `components/consumer/FilterChips.tsx`
- Create: `components/consumer/DishCard.tsx`
- Create: `components/consumer/EmptyState.tsx`
- Create: `components/consumer/ResultsSkeleton.tsx`

**Interfaces:**

- Consumes: `FiltrosExplorador`, `parsearFiltros`, `ConsumerShell`.
- Produces:

```ts
export type ResultadoPlato = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  tipo: TipoVianda;
  fotoUrl: string | null;
  etiquetas: string[];
  viandera: {
    nombre: string;
    slug: string;
    barrio: string | null;
    ofreceRetiro: boolean;
    ofreceEnvio: boolean;
  };
};

export async function buscarPlatos(filtros: FiltrosExplorador): Promise<ResultadoPlato[]>;
```

- [ ] **Step 1: Implementar consulta pública acotada**

Consultar únicamente vianderas activas y platos disponibles. Aplicar tipo, etiqueta y modalidad en Supabase cuando sea posible. Limitar a 48 resultados. No consultar service role.

- [ ] **Step 2: Crear la composición de la ruta**

El primer viewport contiene buscador, título y filtros. Debajo se muestran resultados reales; no incluir categorías sin representación en datos.

- [ ] **Step 3: Implementar estados**

- Loading: tarjetas esqueleto con dimensiones finales.
- Empty: mostrar filtros activos y acciones para limpiar.
- Error: preservar URL y usar `reset()`.
- Resultado único: tarjeta destacada, sin grilla visualmente rota.

- [ ] **Step 4: No instrumentar todavía**

Esta tarea NO registra `explore_viewed`, `search_submitted` ni `filter_applied` — ninguna escritura en `eventos_analitica` puede existir antes de que exista un limitador de solicitudes y costo. `/explorar` se publica sin analítica en esta entrega; la instrumentación de estos tres eventos, junto con los cuatro eventos del perfil, se movió a la **Task 9** (entrega posterior, pausada a pedido explícito — ver esa sección), después de que el limitador exista.

- [ ] **Step 5: Validar**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Verificar manualmente URLs con combinaciones válidas, inválidas y back-button.

- [ ] **Step 6: Commit**

```bash
git add app/explorar components/consumer lib/viandas/consultas.ts
git commit -m "feat: launch public vianda explorer"
```

---

## Task 7: Rediseñar el perfil público y medir WhatsApp

**Estado: completada (parte visual y funcional) — aprobada por Codex el
2026-09-03.** La analítica y el limitador de solicitudes que originalmente
compartían esta tarea (los antiguos Steps 5–7) se separaron a la **Task 9**
como entrega posterior, pausada a pedido explícito para no retrasar la
validación de mercado — ver esa sección. El diseño y el código de
analítica ya construidos en la Task 4 (`lib/analitica/eventos.ts` y sus
pruebas) **no se tocaron ni se eliminaron**, solo quedan sin conectar a la
interfaz todavía.

**Files:**

- Modify: `app/[slug]/page.tsx`
- Create: `components/storefront/StorefrontHeader.tsx`
- Create: `components/storefront/PublicDishCard.tsx`
- Create: `components/storefront/WhatsAppIntent.tsx`
- Create: `components/storefront/StickyContactBar.tsx`
- Create: `lib/viandera/telefono.ts` (surgido durante la implementación — `telefonoParaWhatsapp` vive aparte porque `WhatsAppIntent.tsx` es `"use client"` y `page.tsx`, un Server Component, no puede invocar una función exportada de un módulo cliente)
- Create: `app/[slug]/error.tsx` (surgido durante la implementación — mismo patrón que `app/explorar/error.tsx`, requerido por el estado "Error de carga" del spec)

**Interfaces:**

- Consumes: campos nuevos de `Viandera`.
- Produces: recorrido perfil → confirmación → WhatsApp.

- [x] **Step 1: Extraer presentación sin cambiar la consulta todavía**

Separar cabecera y platos. Mostrar únicamente nombre, bio, barrio, modalidad y fecha de actualización. No mostrar ratings ni sellos.

- [x] **Step 2: Crear selección de plato**

Cada tarjeta puede marcar un plato para preparar el mensaje. El CTA sigue siendo comprensible sin selección: “Consultar por WhatsApp”.

- [x] **Step 3: Crear confirmación accesible**

El diálogo debe explicar que disponibilidad, entrega y pago se coordinan directamente. Debe aceptar Escape, devolver el foco y respetar `prefers-reduced-motion`.

- [x] **Step 4: Preparar el enlace**

Formato:

```ts
const mensaje = plato
  ? `Hola, vi tu perfil en ViandApp. Quería consultar por ${plato.nombre}. ¿Está disponible?`
  : "Hola, vi tu perfil en ViandApp. Quería consultar por tus viandas.";
```

Codificar con `encodeURIComponent`. No incluir precio, dirección ni promesas.

- [x] **Step 5: Verificar estados**

- Perfil sin platos.
- Perfil sin teléfono.
- Perfil inactivo.
- Slug inexistente.
- Bio y nombres largos.
- Foto ausente.

- [x] **Step 6: Validar**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

- [x] **Step 7: Commit**

```bash
git add app/[slug]/page.tsx components/storefront app/[slug]/error.tsx
git commit -m "feat: redesign public storefront with WhatsApp confirmation"
```

Commits reales: `d51aab2` (implementación) y `47620e1` (corrección de
revisión: `StickyContactBar` bajo `overflow-hidden` no se pegaba durante
scroll real, y podía renderizar una barra vacía o un link `wa.me` inválido
con un teléfono compuesto solo por símbolos).

---

## Task 8: Verificación de lanzamiento

**Files:**

- Modify only files that fail verification.
- Modify: `CLAUDE.md` after production prerequisites are confirmed.

**Interfaces:** slice vertical navegable de exploración → perfil → WhatsApp,
sin analítica — la analítica es la Task 9, entrega posterior pausada a
pedido explícito, y no bloquea este lanzamiento.

Checklist completo de salida, en este orden — cada paso condicionado a que
el anterior haya salido bien:

- [ ] **Step 1: Preflight y respaldo**

**Respaldo — verificar antes de tocar nada:**

1. Confirmar en el Dashboard de Supabase (Settings → Billing) qué plan tiene el proyecto real. Los backups diarios automáticos con restauración de un clic **no existen en el plan Free** — son una función de los planes pagos (Pro en adelante). No asumir que existen sin mirarlo.
2. Si el proyecto es Free, o si es un plan superior pero Database → Backups no muestra un backup reciente y restaurable, generar un respaldo lógico manual antes de seguir:

   ```bash
   supabase db dump --db-url "<connection string>" -f respaldo-pre-explorador-mvp.sql
   # equivalente directo:
   pg_dump "<connection string>" -f respaldo-pre-explorador-mvp.sql
   ```

   Verificar que el archivo generado no esté vacío y contenga al menos las tablas `vianderas`, `viandas` e `interesados_viandera` antes de considerarlo un respaldo válido.
3. **No pasar al Step 2 hasta confirmar que existe un respaldo restaurable** — el automático de Supabase en un plan que lo incluye, o el dump manual del punto 2.

**Preflight de esquema — preparado acá, no ejecutar todavía. Correr en el SQL Editor recién en el momento de aplicar la migración, antes de correr el script:**

```sql
-- 1. Forma actual de vianderas y viandas
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('vianderas', 'viandas')
order by table_name, ordinal_position;

-- 2. eventos_analitica: no debe existir todavía, o si existe, su
-- estructura debe coincidir exacto con la migración — si esta consulta
-- devuelve filas, compararlas a mano contra
-- supabase/migrations/202609030001_explorador_mvp.sql antes de seguir.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'eventos_analitica'
order by ordinal_position;

-- `to_regclass(...)` devuelve NULL si la tabla todavía no existe, en vez
-- de lanzar error como `::regclass` — importante acá porque
-- `eventos_analitica` no existir todavía es precisamente el estado
-- esperado antes de la primera corrida de esta migración.
select conname, pg_get_constraintdef(c.oid)
from pg_constraint c
where c.conrelid = to_regclass('public.eventos_analitica');

-- 3. Existencia previa de la función y los triggers involucrados
select proname from pg_proc where proname = 'viandapp_set_updated_at';

select tgname, tgrelid::regclass as tabla
from pg_trigger
where tgname in ('vianderas_set_updated_at', 'viandas_set_updated_at')
  and not tgisinternal;

-- 4. Conteos "antes" — guardar estos tres números para comparar contra
-- los mismos conteos en el Step 3 (Verificación posterior). Esta
-- migración no inserta ni borra ninguna fila de estas tablas, solo agrega
-- columnas — los tres números deben quedar idénticos después de aplicarla.
select
  (select count(*) from public.vianderas) as vianderas,
  (select count(*) from public.viandas) as viandas,
  (select count(*) from public.interesados_viandera) as interesados;
```

Si cualquiera de estas consultas muestra algo inesperado (una columna con
otro tipo, una tabla `eventos_analitica` con una forma distinta, un
trigger con otro nombre apuntando a las mismas tablas), **no aplicar la
migración tal cual** — resolver la discrepancia primero. `if not exists` /
`create or replace` no reconcilian un objeto preexistente con una
definición distinta a la del script; solo evitan el error de "ya existe"
cuando el objeto YA coincide.

- [ ] **Step 2: Aplicar la migración**

Pegar el contenido completo de
`supabase/migrations/202609030001_explorador_mvp.sql` (envuelto en
`begin`/`commit` — todas sus sentencias son DDL transaccional válido en
Postgres, así que corre atómico) en el SQL Editor del proyecto real y
ejecutar. No ejecutar en producción sin confirmación explícita. Registrar
fecha y resultado.

- [ ] **Step 3: Verificación posterior**

```sql
-- 1. Las cuatro columnas nuevas de vianderas: tipo, nullability y default
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'vianderas'
  and column_name in ('barrio', 'ofrece_retiro', 'ofrece_envio', 'updated_at')
order by column_name;
-- esperado: 4 filas —
--   barrio        | text        | YES | (sin default)
--   ofrece_retiro | boolean     | NO  | true
--   ofrece_envio  | boolean     | NO  | false
--   updated_at    | timestamptz | NO  | now()

-- 2. updated_at en viandas
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'viandas' and column_name = 'updated_at';
-- esperado: 1 fila — timestamptz, NO, now()

-- 3. Existencia y definición de la función
select proname, pg_get_functiondef(oid) as definicion
from pg_proc
where proname = 'viandapp_set_updated_at';
-- esperado: 1 fila; el cuerpo debe hacer `new.updated_at = now(); return new;`

-- 4. Ambos triggers, habilitados y apuntando a las tablas correctas
select tgname, tgrelid::regclass as tabla, tgenabled
from pg_trigger
where tgname in ('vianderas_set_updated_at', 'viandas_set_updated_at')
  and not tgisinternal;
-- esperado: 2 filas — vianderas_set_updated_at -> vianderas,
-- viandas_set_updated_at -> viandas, ambos con tgenabled = 'O' (origin, activo)

-- 5. Estructura completa de eventos_analitica
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'eventos_analitica'
order by ordinal_position;
-- esperado: id, nombre, viandera_id, vianda_id, metadata, created_at

select conname, pg_get_constraintdef(c.oid)
from pg_constraint c
where c.conrelid = to_regclass('public.eventos_analitica');
-- esperado: primary key en id, el check de `nombre`, el check
-- eventos_analitica_metadata_is_object, y las dos foreign keys hacia
-- vianderas/viandas

-- 6. RLS efectivamente habilitado (no solo "debería estar")
select relrowsecurity
from pg_class
where oid = to_regclass('public.eventos_analitica');
-- esperado: true

-- 7. Cero políticas públicas
select count(*) from pg_policies where tablename = 'eventos_analitica';
-- esperado: 0 (a propósito — sin insert público)

-- 8. Las filas ya existentes de vianderas recibieron los defaults esperados
select id, nombre, ofrece_retiro, ofrece_envio, updated_at, barrio
from public.vianderas;
-- esperado: ofrece_retiro = true y ofrece_envio = false en TODAS las filas
-- que ya existían antes de migrar; updated_at no nulo en todas; barrio
-- nulo es válido (columna nueva, sin dato previo que migrar)

-- 9. La cantidad de filas no cambió
select
  (select count(*) from public.vianderas) as vianderas,
  (select count(*) from public.viandas) as viandas,
  (select count(*) from public.interesados_viandera) as interesados;
-- comparar contra los tres números guardados en el Step 1 (punto 4 del
-- preflight) — deben ser idénticos
```

- [ ] **Step 4: Completar datos reales mínimos**

Antes de publicar, exigir por viandera: slug, nombre, barrio, teléfono, modalidad y al menos un plato disponible con precio o indicación clara de consulta.

- [ ] **Step 5: Verificación funcional**

Probar:

```text
/explorar
/explorar?q=milanesa
/explorar?tipo=almuerzo
/explorar?modalidad=envio
/explorar?etiqueta=vegetariano
/{slug-real}
```

- [ ] **Step 6: Verificación responsive**

Revisar 320, 375, 768, 1024 y 1440 px; orientación vertical/horizontal; teclado; zoom de texto 200%.

- [ ] **Step 7: Verificación analítica — N/A para este lanzamiento**

La analítica no se conecta en esta entrega (ver Task 9). Este step se
retoma dentro de la propia Task 9 cuando esa entrega se ejecute — no
bloquea el lanzamiento actual.

- [ ] **Step 8: Lighthouse y accesibilidad**

Objetivos orientativos: Accessibility ≥95, Best Practices ≥95, Performance ≥85 en mobile. Corregir problemas funcionales; documentar variaciones atribuibles a red o imágenes remotas.

- [ ] **Step 9: Revisión de diff y commit final del código**

```bash
git status --short
git diff --check
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Si la verificación no exigió cambios, no crear un commit vacío. Si hubo correcciones, revisar `git diff --name-only`, agregar únicamente esos archivos por nombre explícito y crear `fix: complete explorer launch verification`.

- [ ] **Step 10: Push de la rama**

```bash
git push -u origin feat/explorador-mvp-task1
```

- [ ] **Step 11: PR o integración a `main`**

Abrir PR (o merge fast-forward, según lo que se prefiera) recién después
de la aprobación final explícita — no mezclar la rama sin ese visto
bueno.

- [ ] **Step 12: Preview de Vercel, cuando corresponda**

**No asumir que existe integración GitHub↔Vercel con previews por PR, ni
que `main` dispara un deploy automático** — confirmarlo primero en el
Dashboard de Vercel (Project → Settings → Git): qué rama está configurada
como production branch, y si "Automatically deploy" está activo para esa
rama. Si hay previews por PR configurados, revisar el preview deploy del
PR antes de mergear.

- [ ] **Step 13: Deploy de producción**

Una vez mergeado a la rama de producción confirmada en el Step 12, seguir
el deploy en el Dashboard de Vercel hasta que termine (o disparar el
deploy manualmente si no hay auto-deploy configurado).

- [ ] **Step 14: Smoke test en producción**

Probar en el dominio real: `/`, `/explorar`, `/{slug-real}` — confirmar
que cargan sin error, que `/explorar` muestra resultados reales (no el
estado de error ni el vacío por falta de migración), y que el perfil real
permite abrir el diálogo de WhatsApp.

- [ ] **Step 15: Criterio de rollback**

**Rollback de aplicación:** revertir el deploy desde el Dashboard de
Vercel al deployment anterior conocido-bueno — no requiere revertir git
ni tocar la base.

**Rollback de base de datos:** esta migración es aditiva — no elimina
columnas, tablas ni filas existentes, así que un rollback de aplicación
(punto anterior) es seguro sin tocar la base, incluso con la migración ya
aplicada (el código anterior simplemente no lee las columnas nuevas). Un
script de reversa automático (`drop column`, etc.) **no está preparado en
este plan** porque no debería hacer falta para este caso aditivo — si
llegara a haber pérdida o corrupción real de datos, el camino es
restaurar desde el respaldo del Step 1, no un `.down.sql`.

---

## Task 9: Analítica del explorador (entrega posterior — pausada)

**Estado: no iniciada, pausada a pedido explícito el 2026-09-03** para no
retrasar la validación de mercado del MVP navegable (Tasks 1–8). No
bloquea el lanzamiento de la Task 8. El diseño y la lógica de
sanitización ya existen y están probados desde la Task 4
(`lib/analitica/eventos.ts`, `lib/analitica/eventos.test.ts`, 61 tests) —
esta tarea solo falta conectarlos a la interfaz real. No se elimina ni se
reescribe nada de lo ya construido; simplemente no se ejecuta todavía.
Contiene, sin cambios de contenido, lo que antes eran los Steps 5–7 de la
Task 7 y el Step 5 de la Task 8.

**Files:**

- Create: `app/actions/analitica.ts`
- Create: el o los archivos del limitador de solicitudes y costo (nombre y ubicación a definir en el Step 1 — ver nota sobre infraestructura externa)
- Modify: `app/explorar/page.tsx`
- Modify: `app/[slug]/page.tsx`
- Modify: los componentes de storefront que disparan `dish_selected`, `whatsapp_intent` y `whatsapp_clicked`

**Interfaces:**

- Consumes: `registrarEvento` (`lib/analitica/eventos.ts`, ya implementado y probado; no requiere cambios).
- Produces: un limitador de solicitudes y costo, durable y comprobable; `app/actions/analitica.ts` como única acción pública que expone `registrarEvento` al cliente, siempre detrás del limitador; instrumentación de los siete eventos del explorador y del perfil.

- [ ] **Step 1: Construir primero el limitador de solicitudes y costo**

Ninguna escritura en `eventos_analitica` puede conectarse antes de que este limitador exista y esté probado. Debe ser durable (sobrevive a un restart del proceso; nada en memoria de un solo servidor) y comprobable (una prueba puede demostrar que el límite corta la escritura al superarse, no solo que la función existe). Cubre dos dimensiones: un límite global (todo `eventos_analitica`) y uno por sesión/visitante, ambos en una ventana de tiempo.

La elección concreta del mecanismo (tabla propia en Supabase con conteo por ventana, KV/Redis administrado, u otra infraestructura) **no está decidida por este plan** y no debe inventarse en la implementación sin que antes se proponga y se apruebe explícitamente — en particular si requiere aprovisionar infraestructura externa nueva (ej. un servicio de Redis administrado), eso se resuelve y se aprueba antes de ejecutar este Step, no durante. Si la opción aprobada es una tabla propia en Supabase, va a necesitar su propia migración versionada (mismo patrón que `supabase/migrations/202609030001_explorador_mvp.sql`), sujeta a la misma regla de no aplicarse en producción sin confirmación explícita.

- [ ] **Step 2: Crear la acción pública de analítica detrás del limitador**

Crear `app/actions/analitica.ts` (`"use server"`) recién en este punto, después de que el limitador del Step 1 exista. Debe exponer una acción mínima que consulte el limitador antes de delegar en `registrarEvento` (nunca importar `createAdminClient` directamente); si el límite está superado, la acción descarta el evento en silencio, igual que un payload inválido — nunca revienta el recorrido del usuario. `registrarEvento` ya vuelve a sanitizar internamente — la acción no debe confiar en el payload del navegador ni ampliar ese contrato.

- [ ] **Step 3: Instrumentar los siete eventos — explorador y perfil**

Recién ahora se conectan los siete eventos, todos detrás del limitador del Step 1:

- En `app/explorar/page.tsx`: `explore_viewed`, `search_submitted`, `filter_applied` — sin bloquear render ni incluir el texto completo de búsqueda en metadata; como máximo guardar longitud de búsqueda y filtros enumerados.
- En `app/[slug]/page.tsx` y los componentes de storefront: `profile_viewed`, `dish_selected`, `whatsapp_intent`, `whatsapp_clicked`. El último significa clic confirmado en “Continuar a WhatsApp”, no apertura comprobada de la app externa.

`profile_viewed`, `explore_viewed`, `search_submitted` y `filter_applied` pueden registrarse server-side directo en el Server Component correspondiente (sin pasar por la acción); `dish_selected`, `whatsapp_intent` y `whatsapp_clicked` nacen de interacciones de cliente y usan la acción del Step 2. La salida a WhatsApp debe funcionar aunque falle la analítica.

- [ ] **Step 4: Verificación analítica**

Confirmar que los siete eventos llegan, que un fallo de inserción no rompe la UI, que metadata no contiene PII y que los roles públicos no pueden insertar directamente en `eventos_analitica`.

- [ ] **Step 5: Validar**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] **Step 6: Commit**

Agregar también los archivos del limitador del Step 1 (su ruta exacta se define ahí) a este `git add`, junto con la migración correspondiente si el limitador aprobado usa una tabla propia en Supabase.

```bash
git add app/actions/analitica.ts app/explorar/page.tsx app/[slug]/page.tsx components/storefront
git commit -m "feat: connect explorer analytics behind a rate limiter"
```

---

## Deferred plans

Crear planes separados después de medir uso real:

1. Mapa, geolocalización y sincronización lista↔mapa.
2. Disponibilidad por día, horario y “por encargo”.
3. Favoritos y cuentas de consumidor.
4. Monetización ViandApp+ según la definición de producto incluida abajo.
5. Ratings y moderación, solo si existe un mecanismo verificable de compra.

### Definición futura: ViandApp+

**No forma parte del MVP actual.** Crear una especificación y un plan de implementación separados únicamente cuando el explorador y la analítica estén estables.

**Condiciones de activación:**

- Al menos 20–30 vianderas activas con catálogo público.
- Un mínimo de 30 días de tráfico medido.
- Eventos confiables de visitas, platos vistos, intención y clic hacia WhatsApp.
- Entrevistas de validación con 10–15 vianderas.
- Evidencia de que algunas recibieron consultas atribuibles a ViandApp.

**Nombre y posicionamiento:** el nombre comercial aprobado es `ViandApp+` (pronunciado “ViandApp Plus”), no “Premium”. Es una suscripción opcional para conseguir más visibilidad, entender el interés de los consumidores y profesionalizar la difusión. Mantener contacto directo y cero comisión por venta en todos los planes. En código y base de datos usar identificadores estables `free` y `plus`; no guardar textos comerciales como identificadores.

**Plan gratuito:**

- Perfil público completo.
- Hasta 10 platos publicados.
- Fotos, precios, etiquetas, modalidad y zona aproximada.
- Aparición orgánica en resultados.
- Contacto ilimitado por WhatsApp.
- Enlace y QR para compartir el perfil.

**ViandApp+ propuesto:**

- Panel de visitas, platos vistos, intenciones y clics hacia WhatsApp.
- Resumen semanal fácil de interpretar.
- Identificación de platos y filtros que generan mayor interés.
- Catálogo ilimitado y perfil visual ampliado.
- Menú semanal y programación de publicaciones.
- Destacar temporalmente platos elegidos.
- Posiciones patrocinadas claramente identificadas como “Destacado”.
- Generación de placa de menú, historia para redes y QR.
- Mensajes de WhatsApp preparados según el plato consultado.
- Soporte prioritario y acceso anticipado a herramientas comerciales.

**Reglas de confianza:**

- Pagar no otorga una insignia de negocio verificado.
- No vender reseñas, reputación ni datos personales de consumidores.
- No ocultar a las vianderas gratuitas ni degradar artificialmente sus perfiles.
- No prometer ventas garantizadas.
- Separar visualmente resultados patrocinados y orgánicos.

**Programa de cocinas fundadoras:**

- Incorporar manualmente las primeras 5–10 cocinas reales.
- Darles acceso gratuito a ViandApp+ durante seis meses desde la activación.
- Mostrar “Cocina fundadora” como reconocimiento de participación temprana, nunca como sello de identidad, habilitación o calidad verificada.
- Informar desde el comienzo la duración del beneficio y el precio que regirá después; no convertir automáticamente a un plan pago sin consentimiento explícito.

**Hipótesis de precio inicial, expresada en pesos argentinos de septiembre de 2026:**

- Cocinas fundadoras del piloto: ARS 0 durante seis meses para las primeras 5–10 cocinas reales.
- ViandApp+ lanzamiento: ARS 7.900 por mes para las primeras 20–30 suscriptoras pagas, después del piloto.
- ViandApp+ regular: ARS 11.900 por mes.
- Trimestral: ARS 31.900.
- Prueba: 30 días o hasta registrar 10 consultas, lo que ocurra primero.

Revisar precios cada 60–90 días usando como referencia aproximadamente 1,5 viandas estándar por mes. Antes de cobrar, volver a relevar precios reales de Rafaela y comprobar disposición a pagar. La comunicación comercial debe ser: “Si ViandApp te genera aproximadamente un pedido nuevo por semana, el plan puede pagarse solo”, presentada como hipótesis y no como garantía.

**Métricas para decidir continuidad:**

- Conversión de prueba a pago.
- Renovación al segundo y tercer mes.
- Ingreso mensual recurrente.
- Promedio de clics hacia WhatsApp por viandera ViandApp+ y gratuita.
- Costo de adquirir una viandera paga.
- Tasa de cancelación y motivo declarado.

No construir cobros recurrentes, facturación ni ranking patrocinado hasta aprobar una especificación propia que cubra Mercado Pago, permisos, estados de suscripción, cancelaciones, vencimientos, transparencia del ranking y pruebas.
