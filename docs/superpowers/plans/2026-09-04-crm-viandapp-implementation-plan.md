# CRM general de ViandApp — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL:
> `superpowers:subagent-driven-development` o `superpowers:executing-plans`.

**Revisión correctiva 2026-09-04** sobre el commit `4196de3`:
`crm_contactos.pedido_id` eliminado, reemplazado por `crm_contacto_pedidos`
(Task 1) — un consumidor puede tener muchos pedidos; altas idempotentes
explícitas de verdad, no solo "fallan prolijamente" (Task 3); un trigger
nuevo sobre `pedidos` vincula automáticamente un consumidor al CRM **solo**
cuando dio consentimiento de marketing, con copia durable de nombre/
contacto en ese caso (Task 1, Task 5 nueva); TDD ampliado con el caso de
un contacto relacionado con varios pedidos (Task 6 nueva).

**Objetivo:** panel admin-only para contactos (cocinas potenciales/activas,
consumidores identificados con consentimiento de marketing, aliados),
notas, tareas e historial de interacciones, vinculado a las tablas
especializadas sin duplicarlas — salvo la excepción explícita y
justificada de §2/§9 de la spec.

**Arquitectura:** cinco tablas nuevas, RLS habilitado sin ninguna policy
para `anon`/`authenticated`. Una vista de lectura (`crm_contactos_resumen`)
resuelve el nombre/contacto por `coalesce` entre las tablas
especializadas, los campos libres, y (como último recurso) el pedido más
reciente vinculado. Un trigger sobre `pedidos` (agregado por esta
migración, no por la de Carrito y pedidos) automatiza el único caso donde
la automatización está justificada: consentimiento de marketing.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS + PL/pgSQL, Vitest + Vitest de integración (Task 0 del plan de
Carrito y pedidos, reutilizada).

**Spec:** `docs/superpowers/specs/2026-09-04-crm-viandapp-design.md`

**Requiere PRIMERO:**
1. Plan de Carrito y pedidos implementado y su migración aplicada (la
   tabla `pedidos` debe existir — este plan agrega un trigger sobre ella,
   pero el plan de Carrito y pedidos no necesita saber nada de CRM).
2. Preflight de backup de Supabase.

Este plan se implementa **último** de los cuatro deliberadamente — ver
"Orden recomendado de implementación" en el reporte final.

## Global Constraints

- No tocar Supabase hasta revisión de Codex.
- RLS habilitado en las 5 tablas desde el `create table`, sin ninguna
  policy para `anon`/`authenticated`. Todo pasa por `esAdmin()` +
  `createAdminClient()`.
- Nunca copiar `nombre`/`telefono`/`contacto` de `vianderas`/
  `interesados_viandera` — siempre `join`/`coalesce` en el momento de
  lectura. La única excepción es la copia durable de un consumidor
  **con consentimiento de marketing** (Task 1, Task 5) — justificada por
  separado en la spec §2/§9, no una relajación general del principio.
- Un `viandera_id`/`interesado_id` dado tiene a lo sumo un
  `crm_contactos` (índices únicos parciales).
- Un `contacto_libre` de tipo `consumidor` también es único (índice
  parcial nuevo) — así el trigger de consentimiento consolida pedidos
  repetidos del mismo comprador en un solo contacto en vez de crear uno
  por compra.
- Ninguna automatización crea `crm_contactos` para cocinas/interesados —
  eso sigue siendo 100% manual. La única automatización de esta entrega
  es el trigger de consentimiento de marketing sobre `pedidos`.
- Sin nuevas dependencias de npm.
- Todas las funciones puras de negocio llevan TDD. Las garantías que
  dependen de un trigger de Postgres llevan test de integración.

---

### Task 1: Migración — cinco tablas, trigger de consentimiento, vista de resumen

**Files:**
- Create: `supabase/migrations/202609040003_crm.sql`
- Modify: `types/index.ts` (agregar `CrmContacto`, `CrmContactoPedido`,
  `CrmNota`, `CrmTarea`, `CrmInteraccion` y sus entradas en
  `Database.public.Tables`)

- [ ] **Paso 1: Escribir la migración**

```sql
-- CRM interno: contactos vinculados (no copiados, salvo la excepción de
-- consentimiento de marketing) a tablas especializadas, notas, tareas,
-- historial de interacciones. Admin-only por RLS. Aditiva, repetible,
-- transaccional. Agrega un trigger sobre la tabla `pedidos` ya existente
-- (creada por el plan de Carrito y pedidos) — ese plan no necesita saber
-- nada de esto.

begin;

create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in ('cocina_potencial', 'cocina_activa', 'consumidor', 'aliado_estrategico', 'otro')),
  viandera_id uuid references public.vianderas(id) on delete set null,
  interesado_id uuid references public.interesados_viandera(id) on delete set null,
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
     case when interesado_id is not null then 1 else 0 end) <= 1
  ),
  constraint crm_contactos_libre_o_vinculado check (
    viandera_id is not null or interesado_id is not null or nombre_libre is not null
  )
);

create unique index if not exists crm_contactos_viandera_unico
  on public.crm_contactos (viandera_id) where viandera_id is not null;
create unique index if not exists crm_contactos_interesado_unico
  on public.crm_contactos (interesado_id) where interesado_id is not null;
-- Consolida pedidos repetidos del mismo comprador (mismo contacto_libre)
-- en un unico contacto de tipo consumidor.
create unique index if not exists crm_contactos_consumidor_unico
  on public.crm_contactos (tipo, contacto_libre)
  where tipo = 'consumidor' and contacto_libre is not null;

create table if not exists public.crm_contacto_pedidos (
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contacto_id, pedido_id)
);

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
alter table public.crm_contacto_pedidos enable row level security;
alter table public.crm_notas enable row level security;
alter table public.crm_tareas enable row level security;
alter table public.crm_interacciones enable row level security;
-- Deliberadamente sin ninguna policy en las 5 tablas.

drop trigger if exists crm_contactos_set_updated_at on public.crm_contactos;
create trigger crm_contactos_set_updated_at
before update on public.crm_contactos
for each row execute function public.viandapp_set_updated_at();

-- Auto-vincula un pedido al CRM SOLO si dio consentimiento de marketing,
-- con copia durable de nombre/contacto (justificado en la spec §2/§9).
create or replace function public.crm_vincular_pedido_consentido()
returns trigger language plpgsql as $$
declare
  v_contacto_id uuid;
begin
  if not new.acepta_marketing then
    return new;
  end if;

  insert into public.crm_contactos (tipo, nombre_libre, contacto_libre, fuente, estado)
  values ('consumidor', new.nombre_comprador, new.telefono_comprador, 'pedido', 'nuevo')
  on conflict (tipo, contacto_libre) where tipo = 'consumidor' and contacto_libre is not null
  do update set nombre_libre = excluded.nombre_libre
  returning id into v_contacto_id;

  insert into public.crm_contacto_pedidos (contacto_id, pedido_id)
  values (v_contacto_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists crm_vincular_pedido_consentido_trigger on public.pedidos;
create trigger crm_vincular_pedido_consentido_trigger
after insert on public.pedidos
for each row execute function public.crm_vincular_pedido_consentido();

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
  coalesce(v.nombre, i.nombre, c.nombre_libre, ultimo_pedido.nombre_comprador) as nombre,
  coalesce(v.telefono, i.contacto, c.contacto_libre, ultimo_pedido.telefono_comprador) as contacto,
  c.viandera_id,
  c.interesado_id
from public.crm_contactos c
left join public.vianderas v on v.id = c.viandera_id
left join public.interesados_viandera i on i.id = c.interesado_id
left join lateral (
  select p.nombre_comprador, p.telefono_comprador
  from public.crm_contacto_pedidos cp
  join public.pedidos p on p.id = cp.pedido_id
  where cp.contacto_id = c.id
  order by p.created_at desc
  limit 1
) ultimo_pedido on c.nombre_libre is null and c.viandera_id is null and c.interesado_id is null;

commit;
```

- [ ] **Paso 2: Actualizar `types/index.ts`** con los cinco tipos nuevos
  (incluido `CrmContactoPedido`) y sus entradas en `Database`.

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/202609040003_crm.sql types/index.ts
git commit -m "feat: add CRM tables, marketing-consent auto-link trigger, and summary view"
```

---

### Task 2: Funciones puras de negocio (TDD)

**Files:**
- Create: `lib/crm/vinculo.ts`
- Create: `lib/crm/vinculo.test.ts`

**Interfaces:**
- Produce: `validarVinculo` — consumido por Task 3.

- [ ] **Paso 1: Test de `validarVinculo` (falla primero)** — corregido:
  ya no acepta `pedidoId` como vínculo (ese caso pasó a
  `crm_contacto_pedidos`, fuera del alcance de esta función).

```ts
// lib/crm/vinculo.test.ts
import { describe, expect, it } from "vitest";
import { validarVinculo } from "./vinculo";

describe("validarVinculo", () => {
  it("valido con un solo vinculo seteado", () => {
    expect(validarVinculo({ vianderaId: "v1" })).toEqual({ valido: true });
    expect(validarVinculo({ interesadoId: "i1" })).toEqual({ valido: true });
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
  nombreLibre?: string;
};

export function validarVinculo(
  vinculo: VinculoContacto,
): { valido: true } | { valido: false; motivo: string } {
  const cantidadVinculos = [vinculo.vianderaId, vinculo.interesadoId].filter(Boolean).length;

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

### Task 3: Server Actions de CRM — altas idempotentes

**Files:**
- Create: `app/admin/crm/actions.ts`

**Interfaces:**
- Consume: `esAdmin`, `createAdminClient`, `validarVinculo` (Task 2).

- [ ] **Paso 1: `crearContacto`** (corregido: idempotente de verdad, no
  solo "falla prolijamente")

```ts
export type ResultadoCrearContacto =
  | { status: "error"; mensaje: string }
  | { status: "ok"; contactoId: string };

export async function crearContacto(
  vinculo: VinculoContacto,
  tipo: TipoContacto,
  fuente: FuenteContacto,
): Promise<ResultadoCrearContacto> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const validacion = validarVinculo(vinculo);
  if (!validacion.valido) return { status: "error", mensaje: validacion.motivo };

  const admin = createAdminClient();
  const columnaConflicto = vinculo.vianderaId
    ? "viandera_id"
    : vinculo.interesadoId
      ? "interesado_id"
      : null;

  const payload = {
    tipo,
    fuente,
    estado: "nuevo" as const,
    viandera_id: vinculo.vianderaId ?? null,
    interesado_id: vinculo.interesadoId ?? null,
    nombre_libre: vinculo.nombreLibre ?? null,
  };

  if (columnaConflicto) {
    // Idempotente de verdad: on conflict do nothing + select de vuelta,
    // nunca un insert que falle con un error crudo de constraint.
    const { data: insertado } = await admin
      .from("crm_contactos")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (insertado) return { status: "ok", contactoId: insertado.id };

    const { data: existente } = await admin
      .from("crm_contactos")
      .select("id")
      .eq(columnaConflicto, vinculo[columnaConflicto === "viandera_id" ? "vianderaId" : "interesadoId"])
      .single();

    if (existente) return { status: "ok", contactoId: existente.id };
    return { status: "error", mensaje: "No pudimos crear ni encontrar el contacto." };
  }

  const { data, error } = await admin.from("crm_contactos").insert(payload).select("id").single();
  if (error || !data) return { status: "error", mensaje: "No pudimos crear el contacto." };
  return { status: "ok", contactoId: data.id };
}
```

  Nota de implementación: Supabase JS no tiene un `on conflict do
  nothing` directo en el builder para todos los casos — si la versión de
  `@supabase/supabase-js` disponible no lo soporta limpio para este
  patrón, la alternativa es intentar el `insert`, capturar el código de
  error de violación de constraint único (`23505`), y hacer el `select`
  de respaldo en el `catch`/rama de error — mismo resultado observable
  (idempotente), implementación ligeramente distinta. Confirmar cuál
  aplica al implementar, no asumir en el plan.

- [ ] **Paso 2: `actualizarEstadoContacto`** — sin cambios respecto a la
  versión anterior de este plan (actualiza `estado` + inserta
  `crm_interacciones` con `tipo: 'cambio_estado'`).

- [ ] **Paso 3: `agregarNota`**, `crearTarea`, `completarTarea`,
  `registrarInteraccion`, y **`vincularPedidoManualmente`** (nueva —
  para el caso de §6 de la spec: admin vincula un pedido sin
  consentimiento de marketing, sin copiar `nombre_libre` a menos que el
  admin lo pida explícitamente con un parámetro `copiarNombre: boolean`).

- [ ] **Paso 4: Tests** — verificar que ninguna de estas funciones toca
  `createAdminClient` cuando `esAdmin()` es `false`; verificar que
  `crearContacto` llamada dos veces con el mismo `vianderaId` devuelve
  el mismo `contactoId` sin insertar una segunda fila (test de
  integración, Task 0 del plan de Carrito y pedidos).

- [ ] **Paso 5: Commit**

```bash
git add app/admin/crm/actions.ts app/admin/crm/actions.test.ts
git commit -m "feat: add idempotent CRM server actions"
```

---

### Task 4: Panel `/admin/crm`

Sin cambios de fondo respecto a la versión anterior de este plan.

**Files:**
- Create: `app/admin/crm/page.tsx`, `app/admin/crm/[id]/page.tsx`
- Create: `components/admin/crm/ListaContactos.tsx`,
  `DetalleContacto.tsx`, `FormularioNota.tsx`, `FormularioTarea.tsx`

- [ ] **Pasos 1-4**: listado con filtros, botón "Agregar a CRM", detalle
  de contacto (notas/tareas/interacciones), responsive — sin cambios.
  **Corrección de esta revisión**: el detalle de un contacto tipo
  `consumidor` muestra la lista de **todos** sus pedidos vinculados (vía
  `crm_contacto_pedidos`, no un solo `pedido_id`) — al menos fecha y
  total de cada uno.

- [ ] **Paso 5: Commit**

```bash
git add app/admin/crm/ components/admin/crm/
git commit -m "feat: add CRM admin panel with multi-order consumer view"
```

---

### Task 5: Botón "Agregar a CRM" en flujos existentes

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Paso 1: Consulta adicional** en `/admin` para saber qué
  `viandera_id`/`interesado_id` ya tienen contacto de CRM.

- [ ] **Paso 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: link existing leads and vianderas to CRM from the admin panel"
```

---

### Task 6: Tests de integración del trigger de consentimiento

**Files:**
- Create (dentro de la infraestructura de Task 0 del plan de Carrito y
  pedidos): `app/admin/crm/consentimiento.integration.test.ts`

- [ ] **Paso 1: Un pedido con `acepta_marketing = true`** crea
  automáticamente un `crm_contactos` de tipo `consumidor` con
  `nombre_libre`/`contacto_libre` poblados, y una fila en
  `crm_contacto_pedidos` vinculándolo.

- [ ] **Paso 2: Un segundo pedido, mismo `telefono_comprador`, también
  con `acepta_marketing = true`** — **no** crea un segundo
  `crm_contactos` (consolida por el índice único de `contacto_libre`),
  pero sí agrega una segunda fila en `crm_contacto_pedidos` — **un
  contacto CRM relacionado con varios pedidos**, exactamente el caso que
  pedía la revisión.

- [ ] **Paso 3: Un pedido con `acepta_marketing = false`** no crea
  ningún `crm_contactos` ni fila en `crm_contacto_pedidos`.

- [ ] **Paso 4: Commit**

```bash
git add app/admin/crm/consentimiento.integration.test.ts
git commit -m "test: add integration coverage for the marketing-consent CRM trigger"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] `select * from pg_policies where tablename like 'crm_%'` devuelve
  cero filas.
- [ ] Todas las Server Actions de `app/admin/crm/actions.ts` llaman
  `esAdmin()` antes de cualquier lectura/escritura.
- [ ] `crm_contactos_resumen` no expone ninguna columna que no fuera ya
  legible por el admin a través de otra vía existente.
- [ ] La copia durable de nombre/contacto de un consumidor **solo**
  ocurre cuando `pedidos.acepta_marketing = true` — confirmado por test
  de integración (Task 6), no solo por lectura del trigger.
- [ ] Un pedido sin consentimiento de marketing nunca genera
  automáticamente una ficha de CRM.
- [ ] `crm_notas.texto`/`crm_interacciones.resumen`: advertencia en la UI
  para no pegar datos que no hagan falta guardar.

## QA responsive

- [ ] `/admin/crm`: listado y filtros, 375–1440px.
- [ ] `/admin/crm/[id]`: detalle con notas/tareas/interacciones y la
  lista de pedidos vinculados (para un consumidor), mismos breakpoints.

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** Al terminar, detenerse y reportar resultado de tests
(unitarios e integración) y cualquier desvío del plan.
