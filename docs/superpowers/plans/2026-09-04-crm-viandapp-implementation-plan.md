# CRM general de ViandApp — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL:
> `superpowers:subagent-driven-development` o `superpowers:executing-plans`.

**Objetivo:** panel admin-only para contactos (cocinas potenciales/activas,
consumidores identificados, aliados), notas, tareas e historial de
interacciones, vinculado a las tablas especializadas sin duplicarlas.

**Arquitectura:** cuatro tablas nuevas, RLS habilitado sin ninguna policy
para `anon`/`authenticated` (acceso 100% vía Server Actions admin-gated).
Una vista de lectura (`crm_contactos_resumen`) resuelve el nombre/contacto
por `coalesce` entre las tablas especializadas y los campos libres.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-crm-viandapp-design.md`

**Requiere PRIMERO:**
1. Plan de Carrito y pedidos implementado y su migración aplicada (`crm_contactos.pedido_id`
   referencia `pedidos(id)`).
2. Preflight de backup de Supabase.

Este plan se implementa **último** de los cuatro deliberadamente — no
porque dependa técnicamente de todo lo demás en un sentido estricto (podría
implementarse antes con `pedido_id` nullable y agregarlo después), sino
porque diseñar bien `fuente`/`estado` para pedidos y adhesiones sin haber
visto esas tablas reales sería adivinar. Ver "Orden recomendado de
implementación" en el reporte final para el razonamiento completo.

## Global Constraints

- No tocar Supabase hasta revisión de Codex.
- RLS habilitado en las 4 tablas desde el `create table`, sin ninguna
  policy para `anon`/`authenticated` — cero excepciones. Todo pasa por
  `esAdmin()` + `createAdminClient()`.
- Nunca copiar `nombre`/`telefono`/`contacto` de una tabla especializada a
  una columna de `crm_contactos` — siempre `join`/`coalesce` en el momento
  de lectura (vista `crm_contactos_resumen`).
- Un `viandera_id`/`interesado_id`/`pedido_id` dado tiene a lo sumo un
  `crm_contactos` (índices únicos parciales) — vincular dos veces la misma
  entidad falla explícitamente, no crea un duplicado.
- Ninguna automatización crea `crm_contactos` sin que el admin lo pida
  explícitamente en esta entrega (spec §6).
- Sin nuevas dependencias de npm.
- Todas las funciones puras de negocio llevan TDD.

---

### Task 1: Migración — cuatro tablas + vista de resumen

**Files:**
- Create: `supabase/migrations/202609040003_crm.sql`
- Modify: `types/index.ts` (agregar `CrmContacto`, `CrmNota`, `CrmTarea`,
  `CrmInteraccion` y sus entradas en `Database.public.Tables`)

- [ ] **Paso 1: Escribir la migración**

```sql
-- CRM interno: contactos vinculados (no copiados) a tablas especializadas,
-- notas, tareas, historial de interacciones. Admin-only por RLS (sin
-- policies para anon/authenticated). Aditiva, repetible, transaccional.

begin;

create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in ('cocina_potencial', 'cocina_activa', 'consumidor', 'aliado_estrategico', 'otro')),
  viandera_id uuid references public.vianderas(id) on delete set null,
  interesado_id uuid references public.interesados_viandera(id) on delete set null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  nombre_libre text,
  contacto_libre text,
  fuente text not null
    check (fuente in ('landing_interes', 'explorador', 'pedido', 'referido', 'contacto_directo', 'otro')),
  estado text not null
    check (estado in ('nuevo', 'en_conversacion', 'calificado', 'activo', 'inactivo', 'descartado')),
  etiquetas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contactos_un_solo_vinculo check (
    (case when viandera_id is not null then 1 else 0 end +
     case when interesado_id is not null then 1 else 0 end +
     case when pedido_id is not null then 1 else 0 end) <= 1
  ),
  constraint crm_contactos_libre_o_vinculado check (
    viandera_id is not null or interesado_id is not null
    or pedido_id is not null or nombre_libre is not null
  )
);

create unique index if not exists crm_contactos_viandera_unico
  on public.crm_contactos (viandera_id) where viandera_id is not null;
create unique index if not exists crm_contactos_interesado_unico
  on public.crm_contactos (interesado_id) where interesado_id is not null;
create unique index if not exists crm_contactos_pedido_unico
  on public.crm_contactos (pedido_id) where pedido_id is not null;

create table if not exists public.crm_notas (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_tareas (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  vence_en date,
  completada boolean not null default false,
  completada_en timestamptz,
  created_at timestamptz not null default now(),
  constraint crm_tareas_completada_consistente check (
    (completada = false and completada_en is null)
    or (completada = true and completada_en is not null)
  )
);

create table if not exists public.crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  tipo text not null
    check (tipo in ('llamada', 'whatsapp', 'email', 'reunion', 'cambio_estado', 'otro')),
  resumen text not null check (char_length(resumen) between 1 and 1000),
  metadata jsonb not null default '{}'::jsonb,
  ocurrida_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint crm_interacciones_metadata_es_objeto check (jsonb_typeof(metadata) = 'object')
);

alter table public.crm_contactos enable row level security;
alter table public.crm_notas enable row level security;
alter table public.crm_tareas enable row level security;
alter table public.crm_interacciones enable row level security;
-- Deliberadamente sin ninguna policy: todo acceso pasa por
-- createAdminClient() gateado por esAdmin() en Server Actions.

drop trigger if exists crm_contactos_set_updated_at on public.crm_contactos;
create trigger crm_contactos_set_updated_at
before update on public.crm_contactos
for each row execute function public.viandapp_set_updated_at();

create view public.crm_contactos_resumen
with (security_invoker = true) as
select
  c.id,
  c.tipo,
  c.fuente,
  c.estado,
  c.etiquetas,
  c.created_at,
  c.updated_at,
  coalesce(v.nombre, i.nombre, p.nombre_comprador, c.nombre_libre) as nombre,
  coalesce(v.telefono, i.contacto, p.telefono_comprador, c.contacto_libre) as contacto,
  c.viandera_id,
  c.interesado_id,
  c.pedido_id
from public.crm_contactos c
left join public.vianderas v on v.id = c.viandera_id
left join public.interesados_viandera i on i.id = c.interesado_id
left join public.pedidos p on p.id = c.pedido_id;

commit;
```

- [ ] **Paso 2: Actualizar `types/index.ts`** con los cuatro tipos nuevos
  y sus entradas en `Database.public.Tables`, siguiendo el patrón
  existente (`Insert` omite `id`/`created_at`/`updated_at`).

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/202609040003_crm.sql types/index.ts
git commit -m "feat: add CRM tables and summary view"
```

---

### Task 2: Funciones puras de negocio (TDD)

**Files:**
- Create: `lib/crm/vinculo.ts`
- Create: `lib/crm/vinculo.test.ts`

**Interfaces:**
- Produce: `validarVinculo`, `resolverFuenteSugerida` — consumidos por
  Task 3.

- [ ] **Paso 1: Test de `validarVinculo` (falla primero)**

```ts
// lib/crm/vinculo.test.ts
import { describe, expect, it } from "vitest";
import { validarVinculo } from "./vinculo";

describe("validarVinculo", () => {
  it("valido con un solo vinculo seteado", () => {
    expect(validarVinculo({ vianderaId: "v1" })).toEqual({ valido: true });
    expect(validarVinculo({ interesadoId: "i1" })).toEqual({ valido: true });
    expect(validarVinculo({ pedidoId: "p1" })).toEqual({ valido: true });
  });

  it("valido sin ningun vinculo si hay nombreLibre", () => {
    expect(validarVinculo({ nombreLibre: "Puni Rafaela" })).toEqual({ valido: true });
  });

  it("invalido con mas de un vinculo seteado", () => {
    expect(validarVinculo({ vianderaId: "v1", interesadoId: "i1" }).valido).toBe(false);
  });

  it("invalido sin ningun vinculo y sin nombreLibre", () => {
    expect(validarVinculo({}).valido).toBe(false);
  });
});
```

- [ ] **Paso 2: Implementación mínima**

```ts
// lib/crm/vinculo.ts
export type VinculoContacto = {
  vianderaId?: string;
  interesadoId?: string;
  pedidoId?: string;
  nombreLibre?: string;
};

export function validarVinculo(
  vinculo: VinculoContacto,
): { valido: true } | { valido: false; motivo: string } {
  const cantidadVinculos = [vinculo.vianderaId, vinculo.interesadoId, vinculo.pedidoId]
    .filter(Boolean).length;

  if (cantidadVinculos > 1) {
    return { valido: false, motivo: "Un contacto solo puede vincularse a una tabla especializada." };
  }
  if (cantidadVinculos === 0 && !vinculo.nombreLibre) {
    return { valido: false, motivo: "Sin vínculo, hace falta un nombre." };
  }
  return { valido: true };
}
```

- [ ] **Paso 3: Correr tests, confirmar que pasan.**

- [ ] **Paso 4: Commit**

```bash
git add lib/crm/
git commit -m "feat: add pure CRM contact-link validation with tests"
```

---

### Task 3: Server Actions de CRM

**Files:**
- Create: `app/admin/crm/actions.ts`

**Interfaces:**
- Consume: `esAdmin`, `createAdminClient` (existentes), `validarVinculo`
  (Task 2).

- [ ] **Paso 1: `crearContacto`** — recibe `VinculoContacto` + `tipo` +
  `fuente` + `estado` inicial, valida con `validarVinculo`, inserta. Si
  falla por el índice único parcial (ya existe un contacto para esa
  entidad), devuelve un mensaje claro en vez del error crudo de Postgres.

- [ ] **Paso 2: `actualizarEstadoContacto`** — actualiza `estado` y, en la
  misma llamada, inserta una fila en `crm_interacciones` con
  `tipo: 'cambio_estado'` y `metadata: {anterior, nuevo}` (dos escrituras
  secuenciales con el admin client, sin transacción explícita — mismo
  criterio de riesgo aceptado que `invitarViandera`, que también hace
  varios pasos sin wrapping transaccional).

- [ ] **Paso 3: `agregarNota`**, `crearTarea`, `completarTarea`,
  `registrarInteraccion` — CRUD directo, todos gateados por `esAdmin()`.

- [ ] **Paso 4: Tests** — verificar que ninguna de estas funciones toca
  `createAdminClient` cuando `esAdmin()` es `false` (mock que falla el
  test si se invoca).

- [ ] **Paso 5: Commit**

```bash
git add app/admin/crm/actions.ts app/admin/crm/actions.test.ts
git commit -m "feat: add CRM server actions"
```

---

### Task 4: Panel `/admin/crm`

**Files:**
- Create: `app/admin/crm/page.tsx` (listado, lee de
  `crm_contactos_resumen`)
- Create: `app/admin/crm/[id]/page.tsx` (detalle: notas, tareas,
  interacciones)
- Create: `components/admin/crm/ListaContactos.tsx`
- Create: `components/admin/crm/DetalleContacto.tsx`
- Create: `components/admin/crm/FormularioNota.tsx`
- Create: `components/admin/crm/FormularioTarea.tsx`

**Interfaces:**
- Consume: Server Actions de Task 3.

- [ ] **Paso 1: Listado** — filtros simples por `tipo`/`estado`/`fuente`
  (query params en la URL, mismo patrón que `/explorar`), tarjeta por
  contacto con nombre (de la vista), tipo, estado, etiquetas.

- [ ] **Paso 2: Botón "Agregar a CRM"** en los lugares donde tiene sentido
  crear un contacto desde una entidad existente: en `/admin` (para una
  fila de `interesados_viandera` o `vianderas` sin contacto de CRM
  todavía) y en el futuro panel de pedidos de `/admin` si existe — llama
  `crearContacto` con el vínculo correspondiente ya resuelto (sin que el
  admin tenga que tipear IDs a mano).

- [ ] **Paso 3: Detalle de contacto** — notas (lista + formulario nuevo),
  tareas (lista con checkbox de completar + formulario nuevo), historial
  de interacciones (lista de solo lectura, incluye los `cambio_estado`
  automáticos).

- [ ] **Paso 4: Verificar responsive** 375–1440px.

- [ ] **Paso 5: Commit**

```bash
git add app/admin/crm/ components/admin/crm/
git commit -m "feat: add CRM admin panel"
```

---

### Task 5: Botón "Agregar a CRM" en flujos existentes

**Files:**
- Modify: `app/admin/page.tsx` (agregar el botón junto a cada fila de
  `interesados_viandera` y `vianderas` que todavía no tenga
  `crm_contactos`)

**Interfaces:**
- Consume: `crearContacto` (Task 3).

- [ ] **Paso 1: Consulta adicional** en `/admin` para saber qué
  `viandera_id`/`interesado_id` ya tienen contacto de CRM (para no
  mostrar el botón dos veces ni intentar un insert que va a fallar por el
  índice único).

- [ ] **Paso 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: link existing leads and vianderas to CRM from the admin panel"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] Confirmar con una query directa (fuera de la app) que ninguna de las
  4 tablas tiene una sola policy de RLS activa — `select * from
  pg_policies where tablename like 'crm_%'` debe devolver cero filas.
- [ ] Todas las Server Actions de `app/admin/crm/actions.ts` llaman
  `esAdmin()` antes de cualquier lectura/escritura.
- [ ] `crm_contactos_resumen` no expone ninguna columna que no fuera ya
  legible por el admin a través de otra vía existente.
- [ ] Ningún dato nuevo de PII se introduce — se confirma leyendo el
  `select` de la vista y verificando que cada columna proviene de una
  tabla que ya lo exponía.
- [ ] `crm_notas.texto`/`crm_interacciones.resumen`: agregar una nota
  visible en la UI del formulario ("no pegues acá datos que no hagan
  falta guardar") — no es un control técnico, es una mitigación de
  proceso, documentada como tal.

## QA responsive

- [ ] `/admin/crm`: listado y filtros, 375–1440px.
- [ ] `/admin/crm/[id]`: detalle con notas/tareas/interacciones, mismos
  breakpoints, formularios usables en mobile.

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** Al terminar, detenerse y reportar resultado de tests
y cualquier desvío del plan.
