# CRM general de ViandApp — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL:
> `superpowers:subagent-driven-development` o `superpowers:executing-plans`.

**Segunda revisión correctiva 2026-09-04** sobre el commit `2ee4acc`:
interesados/cocinas se sincronizan automáticamente vía trigger (Task 1,
Task 5 — ya no manual); deduplicación de consumidores por
`contacto_normalizado` (teléfono/email normalizado), no por texto crudo
(Task 1, Task 2); retiro de consentimiento y anonimización de PII
comercial (Task 1, Task 3 nueva); `vincularPedidoManualmente` corregida
para nunca poder crear una copia durable sin consentimiento (Task 3);
TDD ampliado con teléfonos equivalentes y exclusión por retiro de
consentimiento (Task 6).

**Objetivo:** panel admin-only para contactos (cocinas potenciales/
activas sincronizadas automáticamente, consumidores identificados con
consentimiento de marketing, aliados), con retiro de consentimiento y
anonimización disponibles.

**Arquitectura:** cinco tablas, RLS sin policies. Triggers sobre
`interesados_viandera`, `vianderas` y `pedidos` (todas ya existentes,
agregados por esta migración — ningún otro plan necesita saber que el
CRM existe) sincronizan automáticamente, con distinta base legal cada
uno: interesados/cocinas no tienen restricción de consentimiento
(dieron sus datos directamente para ese propósito); consumidores solo se
vinculan con copia durable si dieron consentimiento de marketing,
deduplicados por contacto normalizado.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS + PL/pgSQL, Vitest + Vitest de integración (Task 0 del plan de
Carrito y pedidos).

**Spec:** `docs/superpowers/specs/2026-09-04-crm-viandapp-design.md`

**Requiere PRIMERO:**
1. Plan de Carrito y pedidos implementado y aplicado.
2. Preflight de backup de Supabase.

## Global Constraints

- No tocar Supabase hasta revisión de Codex.
- RLS habilitado en las 5 tablas, sin ninguna policy.
- Deduplicación de consumidores por `contacto_normalizado`
  (teléfono/email normalizado, columna generada), **nunca** por
  `contacto_libre` crudo.
- Interesados y cocinas activas se sincronizan **automática e
  idempotentemente** al CRM — no depende de que el admin recuerde un
  botón.
- Consumidores solo obtienen copia durable de PII con consentimiento de
  marketing explícito (`pedidos.acepta_marketing = true`) — **bajo
  ninguna circunstancia**, ni siquiera manualmente por el admin, un
  pedido sin ese consentimiento puede generar una ficha comercial
  durable.
- El retiro de consentimiento excluye de inmediato de cualquier acción
  comercial futura, y puede ir acompañado de anonimización de la PII
  conservando las relaciones operativas (`crm_contacto_pedidos`).
- Sin nuevas dependencias de npm.
- Todas las funciones puras llevan TDD. Las garantías de trigger llevan
  test de integración.

---

### Task 1: Migración — tablas, normalización, tres triggers de sincronización, retiro de consentimiento

**Files:**
- Create: `supabase/migrations/202609040003_crm.sql`
- Modify: `types/index.ts`

- [ ] **Paso 1: Escribir la migración**

```sql
-- CRM interno. Interesados/cocinas se sincronizan automaticamente
-- (triggers sobre interesados_viandera/vianderas). Consumidores solo con
-- consentimiento de marketing, deduplicados por contacto normalizado
-- (no texto crudo). Retiro de consentimiento y anonimizacion incluidos.
-- RLS sin policies. Aditiva, repetible, transaccional.

begin;

create or replace function public.crm_normalizar_contacto(p_tipo text, p_contacto_libre text)
returns text
language sql
immutable
as $$
  select case
    when p_contacto_libre is null then null
    when p_contacto_libre like '%@%' then lower(trim(p_contacto_libre))
    else regexp_replace(p_contacto_libre, '[^0-9]', '', 'g')
  end;
$$;

create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in ('cocina_potencial', 'cocina_activa', 'consumidor', 'aliado_estrategico', 'otro')),
  viandera_id uuid references public.vianderas(id) on delete set null,
  interesado_id uuid references public.interesados_viandera(id) on delete set null,
  nombre_libre text,
  contacto_libre text,
  contacto_normalizado text generated always as (public.crm_normalizar_contacto(tipo, contacto_libre)) stored,
  fuente text not null
    check (fuente in ('landing_interes', 'explorador', 'pedido', 'referido', 'contacto_directo', 'otro')),
  estado text not null
    check (estado in ('nuevo', 'en_conversacion', 'calificado', 'activo', 'inactivo', 'descartado')),
  etiquetas text[] not null default '{}',
  consentimiento_retirado_en timestamptz,
  pii_eliminada boolean not null default false,
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
create unique index if not exists crm_contactos_consumidor_unico
  on public.crm_contactos (tipo, contacto_normalizado)
  where tipo = 'consumidor' and contacto_normalizado is not null;

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
-- Sin ninguna policy en las 5 tablas.

drop trigger if exists crm_contactos_set_updated_at on public.crm_contactos;
create trigger crm_contactos_set_updated_at
before update on public.crm_contactos
for each row execute function public.viandapp_set_updated_at();

-- Sincronizacion automatica: interesados de la landing (corregido en
-- esta revision, antes era manual).
create or replace function public.crm_sincronizar_interesado()
returns trigger language plpgsql as $$
begin
  insert into public.crm_contactos (tipo, interesado_id, fuente, estado)
  values ('cocina_potencial', new.id, 'landing_interes', 'nuevo')
  on conflict (interesado_id) where interesado_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists crm_sincronizar_interesado_trigger on public.interesados_viandera;
create trigger crm_sincronizar_interesado_trigger
after insert on public.interesados_viandera
for each row execute function public.crm_sincronizar_interesado();

-- Sincronizacion automatica: cocinas activas (corregido, antes manual).
create or replace function public.crm_sincronizar_viandera()
returns trigger language plpgsql as $$
begin
  insert into public.crm_contactos (tipo, viandera_id, fuente, estado)
  values ('cocina_activa', new.id, 'contacto_directo', 'nuevo')
  on conflict (viandera_id) where viandera_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists crm_sincronizar_viandera_trigger on public.vianderas;
create trigger crm_sincronizar_viandera_trigger
after insert on public.vianderas
for each row execute function public.crm_sincronizar_viandera();

-- Consumidores: solo con consentimiento de marketing, deduplicados por
-- contacto_normalizado (corregido -- antes era contacto_libre crudo).
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
  on conflict (tipo, contacto_normalizado) where tipo = 'consumidor' and contacto_normalizado is not null
  do update set nombre_libre = excluded.nombre_libre, contacto_libre = excluded.contacto_libre
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
  c.consentimiento_retirado_en,
  c.pii_eliminada,
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

- [ ] **Paso 2: Actualizar `types/index.ts`** con los tipos nuevos,
  incluyendo `contacto_normalizado`, `consentimiento_retirado_en`,
  `pii_eliminada` en `CrmContacto`.

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/202609040003_crm.sql types/index.ts
git commit -m "feat: auto-sync leads/kitchens, normalize consumer dedup, add consent withdrawal"
```

---

### Task 2: Funciones puras — vínculo y normalización (TDD)

**Files:**
- Create: `lib/crm/vinculo.ts`, `lib/crm/vinculo.test.ts`
- Create: `lib/crm/normalizarContacto.ts`, `lib/crm/normalizarContacto.test.ts`

- [ ] **Paso 1-4: `validarVinculo`** — sin cambios respecto a la versión
  anterior de este plan.

- [ ] **Paso 5: Test de `normalizarContacto` (falla primero)** —
  implementación TypeScript equivalente a la función SQL de la Task 1,
  con un set de casos compartido para poder confirmar que ambas
  producen el mismo resultado (riesgo de duplicación de lógica,
  reconocido en la spec §9):

```ts
// lib/crm/normalizarContacto.test.ts
import { describe, expect, it } from "vitest";
import { normalizarContacto } from "./normalizarContacto";

describe("normalizarContacto", () => {
  it("telefonos con formato distinto normalizan al mismo valor", () => {
    expect(normalizarContacto("3548 635151")).toBe(normalizarContacto("+54 9 3548-635151"));
    expect(normalizarContacto("(3548) 635-151")).toBe(normalizarContacto("3548635151"));
  });

  it("emails normalizan a minusculas sin espacios", () => {
    expect(normalizarContacto(" Maria@Ejemplo.com ")).toBe("maria@ejemplo.com");
  });

  it("null devuelve null", () => {
    expect(normalizarContacto(null)).toBeNull();
  });
});
```

- [ ] **Paso 6: Implementación — mismo criterio que la función SQL
  (extraer solo dígitos si no hay `@`, minúsculas+trim si lo hay)**

```ts
// lib/crm/normalizarContacto.ts
export function normalizarContacto(contactoLibre: string | null): string | null {
  if (contactoLibre === null) return null;
  if (contactoLibre.includes("@")) return contactoLibre.trim().toLowerCase();
  return contactoLibre.replace(/[^0-9]/g, "");
}
```

- [ ] **Paso 7: Correr tests, confirmar que pasan.**

- [ ] **Paso 8: Commit**

```bash
git add lib/crm/vinculo.ts lib/crm/vinculo.test.ts lib/crm/normalizarContacto.ts lib/crm/normalizarContacto.test.ts
git commit -m "feat: add pure contact-link validation and contact normalization with tests"
```

---

### Task 3: Server Actions — altas, retiro de consentimiento, anonimización

**Files:**
- Create: `app/admin/crm/actions.ts`

**Interfaces:**
- Consume: `esAdmin`, `createAdminClient`, `validarVinculo` (Task 2).

- [ ] **Paso 1: `crearContacto`** — sin cambios respecto a la versión
  anterior de este plan (idempotente vía `on conflict do nothing` +
  `select` de respaldo). Ya no hace falta usarla para interesados/
  vianderas (ahora automático, Task 1) — queda para el caso "aliado
  estratégico" (`nombreLibre`, sin FK) y para vincular manualmente un
  pedido no consentido (ver Paso 3).

- [ ] **Paso 2: `actualizarEstadoContacto`** — sin cambios.

- [ ] **Paso 3: `vincularPedidoManualmente`** (corregida en esta
  revisión — **nunca** puede crear una copia durable sin consentimiento)

```ts
export async function vincularPedidoManualmente(
  contactoId: string,
  pedidoId: string,
): Promise<ResultadoGenerico> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const admin = createAdminClient();
  // Solo vincula (crm_contacto_pedidos) -- nunca toca nombre_libre ni
  // contacto_libre del contacto. No hay parametro "copiarNombre": esa
  // via se elimino en esta revision. La unica manera de que un
  // consumidor obtenga una copia durable es el trigger de consentimiento
  // (Task 1), nunca esta accion manual.
  const { error } = await admin
    .from("crm_contacto_pedidos")
    .insert({ contacto_id: contactoId, pedido_id: pedidoId })
    .select()
    .maybeSingle();

  // on conflict do nothing implicito via la PK compuesta -- un insert
  // duplicado no falla de forma visible al usuario si ya existia
  // (verificar el manejo exacto del error 23505 al implementar).
  if (error && error.code !== "23505") {
    return { status: "error", mensaje: "No pudimos vincular el pedido." };
  }
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}
```

- [ ] **Paso 4: `retirarConsentimiento(contactoId)`**

```ts
export async function retirarConsentimiento(contactoId: string): Promise<ResultadoGenerico> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_contactos")
    .update({ consentimiento_retirado_en: new Date().toISOString() })
    .eq("id", contactoId);

  if (error) return { status: "error", mensaje: "No pudimos registrar el retiro." };
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}
```

- [ ] **Paso 5: `anonimizarContacto(contactoId)`**

```ts
export async function anonimizarContacto(contactoId: string): Promise<ResultadoGenerico> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const admin = createAdminClient();
  // Si no se retiro consentimiento todavia, esta accion lo implica --
  // no tiene sentido anonimizar sin tambien excluir de acciones futuras.
  const { error } = await admin
    .from("crm_contactos")
    .update({
      nombre_libre: null,
      contacto_libre: null,
      pii_eliminada: true,
      consentimiento_retirado_en: new Date().toISOString(),
    })
    .eq("id", contactoId);

  if (error) return { status: "error", mensaje: "No pudimos anonimizar el contacto." };
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}
```

- [ ] **Paso 6: `agregarNota`**, `crearTarea`, `completarTarea`,
  `registrarInteraccion` — sin cambios.

- [ ] **Paso 7: Tests** — `vincularPedidoManualmente` nunca acepta ni
  procesa un parámetro de nombre/copia (confirmado por la forma del
  tipo, no en runtime); `retirarConsentimiento`/`anonimizarContacto`
  rechazan sin `esAdmin()`.

- [ ] **Paso 8: Commit**

```bash
git add app/admin/crm/actions.ts app/admin/crm/actions.test.ts
git commit -m "feat: add CRM actions with consent withdrawal and PII anonymization"
```

---

### Task 4: Panel `/admin/crm`

Sin cambios de fondo respecto a la versión anterior — listado, detalle
con notas/tareas/interacciones y lista de pedidos vinculados. **Nuevo en
esta revisión**: el detalle de contacto muestra el estado de
consentimiento (`consentimiento_retirado_en`/`pii_eliminada` de la
vista) con botones "Retirar consentimiento" / "Anonimizar" cuando
corresponde.

**Files:**
- Create: `app/admin/crm/page.tsx`, `app/admin/crm/[id]/page.tsx`
- Create: `components/admin/crm/ListaContactos.tsx`,
  `DetalleContacto.tsx`, `FormularioNota.tsx`, `FormularioTarea.tsx`

- [ ] **Pasos 1-5**: listado con filtros (incluir filtro por estado de
  consentimiento), detalle de contacto con acciones de retiro/
  anonimización, responsive.

- [ ] **Paso 6: Commit**

```bash
git add app/admin/crm/ components/admin/crm/
git commit -m "feat: add CRM admin panel with consent management"
```

---

### Task 5: Botón "Agregar a CRM" — solo para aliados y vínculo manual de pedidos

**Files:**
- Modify: `app/admin/page.tsx`

**Corregido en esta revisión**: ya no hace falta el botón para
interesados/vianderas (Task 1 los sincroniza automáticamente). El botón
que queda en `/admin` es para dos casos: crear un `aliado_estrategico`
(sin FK, `nombreLibre`), y vincular manualmente un pedido no consentido
a un contacto ya existente (`vincularPedidoManualmente`, Task 3).

- [ ] **Paso 1**: UI para ambos casos.

- [ ] **Paso 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add CRM linking UI for allies and manual order association"
```

---

### Task 6: Tests de integración

**Files:**
- Create: `app/admin/crm/consentimiento.integration.test.ts`
- Create: `app/admin/crm/sincronizacion.integration.test.ts`

- [ ] **Un `interesados_viandera` insertado crea automáticamente su
  `crm_contactos`** — sin llamar ninguna acción manual.
- [ ] **Insertarlo dos veces (mismo `interesado_id`, escenario de
  prueba) no duplica** — idempotencia del trigger.
- [ ] **Una `vianderas` insertada crea automáticamente su
  `crm_contactos`** de tipo `cocina_activa`.
- [ ] **Un pedido con `acepta_marketing = true`** crea el contacto
  consumidor con copia durable + vínculo en `crm_contacto_pedidos`.
- [ ] **Un segundo pedido, mismo teléfono pero con formato distinto**
  (ej. `"3548 635151"` vs. `"+54 9 3548-635151"`) — **consolida en el
  mismo contacto** (por `contacto_normalizado`, no el texto crudo) — el
  caso explícito pedido en la revisión: "teléfonos equivalentes con
  formatos distintos producen un solo contacto".
- [ ] **Un pedido con `acepta_marketing = false`** no crea nada
  automáticamente, y `vincularPedidoManualmente` sobre ese pedido no
  crea `nombre_libre`/`contacto_libre` bajo ninguna circunstancia.
- [ ] **Retiro de consentimiento excluye al consumidor del CRM
  comercial**: después de `retirarConsentimiento`, cualquier consulta
  que en el futuro filtre por "contactos elegibles para marketing" (aun
  si esta entrega no tiene todavía ninguna) debe poder confiar en
  `consentimiento_retirado_en is null` como el filtro — el test
  confirma que el campo se setea correctamente y que
  `anonimizarContacto` además nullea `nombre_libre`/`contacto_libre` sin
  borrar `crm_contacto_pedidos`.

- [ ] **Commit**

```bash
git add app/admin/crm/consentimiento.integration.test.ts app/admin/crm/sincronizacion.integration.test.ts
git commit -m "test: add integration coverage for auto-sync, normalized dedup, and consent withdrawal"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] `select * from pg_policies where tablename like 'crm_%'` devuelve
  cero filas.
- [ ] Todas las Server Actions llaman `esAdmin()` antes de cualquier
  operación.
- [ ] Deduplicación de consumidores confirmada por `contacto_normalizado`,
  no `contacto_libre` (test de integración de la Task 6 con formatos
  distintos del mismo teléfono).
- [ ] `vincularPedidoManualmente` no tiene ningún parámetro ni rama de
  código que pueda copiar `nombre_libre`/`contacto_libre` de un pedido
  sin `acepta_marketing = true`.
- [ ] Los triggers de sincronización de interesados/cocinas son
  idempotentes (`on conflict do nothing`), probado insertando dos veces
  en el test de integración.
- [ ] `retirarConsentimiento`/`anonimizarContacto` gateados por
  `esAdmin()`.
- [ ] `anonimizarContacto` conserva `crm_contacto_pedidos` (relación
  operativa) mientras nullea la PII.

## QA responsive

- [ ] `/admin/crm`: listado, filtros (incluido por consentimiento),
  375–1440px.
- [ ] `/admin/crm/[id]`: detalle con acciones de retiro/anonimización,
  mismos breakpoints.

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** Al terminar, detenerse y reportar resultado de tests
(unitarios e integración) y cualquier desvío del plan.
