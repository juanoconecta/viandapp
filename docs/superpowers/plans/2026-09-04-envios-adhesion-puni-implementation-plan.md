# Configuración de envíos y adhesión a Puni — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL: usar
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans` para implementar tarea por tarea. Los pasos
> usan sintaxis de checkbox (`- [ ]`).

**Revisión correctiva 2026-09-04** sobre el commit `4196de3`: la tabla
`puni_adhesiones` queda sin ninguna policy pública de SELECT — la
superficie pública se sirve por consulta server-only, nunca por RLS/vista
(Task 1, Task 7); el costo de Puni lo carga la vendedora, no el admin
(Task 1 trigger, Task 3, Task 4, Task 5, Task 6); `modalidadesDisponibles`
excluye cualquier modalidad con costo `null`, incluida `envio_propio` sin
`costo_envio_propio` cargado (Task 2); TDD ampliado con los casos de
imposibilidad de auto-aprobarse y de leer `nota_admin` públicamente
(Task 8, nueva).

**Objetivo:** exponer retiro/envío propio (costo, cobertura) en el perfil
de viandera, y un flujo de solicitud/aprobación de adhesión a Puni donde
el admin solo verifica y resuelve el estado — la vendedora configura el
costo que cobra por esa modalidad.

**Arquitectura:** dos columnas nuevas en `vianderas` + una tabla nueva
`puni_adhesiones`, **totalmente privada** por RLS (ninguna policy para
`anon`/`authenticated` más allá de "la vendedora ve/actualiza su propia
fila"). La superficie pública (insignia, costo para el carrito) se sirve
mediante una función server-only con `createAdminClient()` y un `select`
explícito de columnas — nunca una vista ni policy pública.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS, Vitest + Vitest de integración (ver Task 0 del plan de Carrito y
pedidos, se reutiliza la misma infraestructura acá).

**Spec:** `docs/superpowers/specs/2026-09-04-envios-adhesion-puni-design.md`

**Requiere PRIMERO (fuera de este plan, antes de la Task 1):** confirmar en
el Supabase Dashboard qué plan tiene el proyecto y si existe backup
restaurable — mismo preflight que el resto de las migraciones del
proyecto.

## Global Constraints

- No tocar Supabase hasta que Codex revise este plan.
- RLS habilitado en `puni_adhesiones` desde el `create table` mismo.
  **Ninguna policy de SELECT para `anon`/`authenticated`** — la única
  policy de select es "la vendedora ve su propia fila". Cero excepciones,
  cero vistas públicas.
- La vendedora NUNCA puede escribir `estado = 'aprobada'`.
- El admin NUNCA escribe `costo_envio_puni` — ninguna Server Action de
  `app/admin/actions.ts` acepta ese campo como input.
- Una modalidad con costo `null` (`costo_envio_propio` o
  `costo_envio_puni`) nunca aparece en `modalidadesDisponibles`.
- Las transiciones de admin usan `createAdminClient()` gateado por
  `esAdmin(user?.email)` — mismo patrón que `invitarViandera`.
- `nota_admin`/`resuelto_por`/`resuelto_en` nunca alcanzables desde
  `anon`/`authenticated` bajo ninguna vía.
- Sin nuevas dependencias de npm.
- Cada ruta raíz nueva se suma a `RUTAS_RESERVADAS` — no aplica en esta
  entrega.
- Todas las funciones puras de negocio llevan TDD: test que falla
  primero.

---

### Task 1: Migración — columnas de envío en `vianderas` + tabla `puni_adhesiones` privada

**Files:**
- Create: `supabase/migrations/202609040001_envios_adhesion_puni.sql`
- Modify: `types/index.ts` (agregar campos a `Viandera`, agregar tipo
  `PuniAdhesion` y su entrada en `Database.public.Tables`)

**Interfaces:**
- Produce: tablas `vianderas` (extendida) y `puni_adhesiones` — esta
  última **sin ninguna vía de lectura pública a nivel de base**; la
  Task 7 construye la única superficie pública, server-only.

- [ ] **Paso 1: Escribir la migración**

```sql
-- Envíos a nivel de cocina + adhesión administrada a Puni.
-- puni_adhesiones queda totalmente privada por RLS: la única policy de
-- select es "la vendedora ve su propia fila". Sin vista ni policy
-- pública — la superficie pública se sirve server-only (ver plan, Task 7).
-- Aditiva, repetible, transaccional.

begin;

alter table public.vianderas
  add column if not exists costo_envio_propio numeric check (costo_envio_propio >= 0),
  add column if not exists cobertura_envio text;

create table if not exists public.puni_adhesiones (
  id uuid primary key default gen_random_uuid(),
  viandera_id uuid not null references public.vianderas(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','rechazada','suspendida','revocada')),
  costo_envio_puni numeric check (costo_envio_puni >= 0),
  solicitado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por text,
  nota_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viandera_id)
);

alter table public.puni_adhesiones enable row level security;

drop trigger if exists puni_adhesiones_set_updated_at on public.puni_adhesiones;
create trigger puni_adhesiones_set_updated_at
before update on public.puni_adhesiones
for each row execute function public.viandapp_set_updated_at();

-- Dos casos válidos para sesiones sin service role: (1) re-solicitar tras
-- rechazo/revocación, (2) actualizar costo_envio_puni mientras aprobada.
-- Cualquier otra cosa (incluido cualquier intento de escribir 'aprobada')
-- se rechaza. El admin (service_role) no pasa por acá.
create or replace function public.puni_adhesiones_validar_update_vendedora()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if old.estado in ('rechazada', 'revocada') and new.estado = 'pendiente' then
    if new.costo_envio_puni is distinct from old.costo_envio_puni
       or new.nota_admin is distinct from old.nota_admin
       or new.resuelto_por is distinct from old.resuelto_por
       or new.resuelto_en is distinct from old.resuelto_en then
      raise exception 'al re-solicitar solo se puede cambiar el estado';
    end if;
    return new;
  end if;

  if old.estado = 'aprobada' and new.estado = 'aprobada' then
    if new.nota_admin is distinct from old.nota_admin
       or new.resuelto_por is distinct from old.resuelto_por
       or new.resuelto_en is distinct from old.resuelto_en
       or new.viandera_id is distinct from old.viandera_id then
      raise exception 'solo se puede actualizar el costo de envio';
    end if;
    return new;
  end if;

  raise exception 'transicion no permitida para esta sesion';
end;
$$;

drop trigger if exists puni_adhesiones_validar_update on public.puni_adhesiones;
create trigger puni_adhesiones_validar_update
before update on public.puni_adhesiones
for each row execute function public.puni_adhesiones_validar_update_vendedora();

create policy "viandera ve su propia adhesion"
  on public.puni_adhesiones for select
  using (viandera_id in (select id from public.vianderas where user_id = auth.uid()));

create policy "viandera solicita adhesion"
  on public.puni_adhesiones for insert
  with check (
    viandera_id in (select id from public.vianderas where user_id = auth.uid())
    and estado = 'pendiente'
    and costo_envio_puni is null
    and resuelto_por is null
  );

create policy "viandera actualiza su propia adhesion"
  on public.puni_adhesiones for update
  using (viandera_id in (select id from public.vianderas where user_id = auth.uid()));

-- Deliberadamente sin ninguna policy de select para anon/authenticated.
-- No hay vista pública. Ver Task 7 para la superficie pública server-only.

commit;
```

- [ ] **Paso 2: Actualizar `types/index.ts`** — sin cambios respecto a la
  versión anterior de este plan (`Viandera` con los dos campos nuevos,
  tipo `PuniAdhesion`, entrada en `Database`).

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/202609040001_envios_adhesion_puni.sql types/index.ts
git commit -m "feat: add migration for shipping config and private Puni adhesion table"
```

**No aplicar la migración todavía.**

---

### Task 2: Funciones puras de negocio (TDD)

**Files:**
- Create: `lib/envios/modalidades.ts`
- Create: `lib/envios/modalidades.test.ts`
- Create: `lib/envios/transiciones.ts`
- Create: `lib/envios/transiciones.test.ts`

**Interfaces:**
- Produce: `modalidadesDisponibles`, `costoEnvioVigente`,
  `transicionValida` — consumidos por Tasks 3-7 y reexportados por el plan
  de Carrito y pedidos.

- [ ] **Paso 1-4**: `transicionValida` — sin cambios respecto a la versión
  anterior de este plan (la tabla de transiciones de admin/vendedora ya
  no incluye costo como parámetro en ningún caso, así que no había nada
  que corregir acá — el error de la revisión anterior estaba en el
  Server Action de admin, Task 4, no en esta función).

- [ ] **Paso 5: Test de `modalidadesDisponibles` y `costoEnvioVigente`
  (falla primero) — con los casos nuevos de esta revisión**

```ts
// lib/envios/modalidades.test.ts
import { describe, expect, it } from "vitest";
import { modalidadesDisponibles, costoEnvioVigente } from "./modalidades";

const vianderaBase = {
  ofrece_retiro: false,
  ofrece_envio: false,
  costo_envio_propio: null as number | null,
};

describe("modalidadesDisponibles", () => {
  it("incluye retiro solo si ofrece_retiro", () => {
    expect(modalidadesDisponibles({ ...vianderaBase, ofrece_retiro: true }, null))
      .toContain("retiro");
    expect(modalidadesDisponibles(vianderaBase, null)).not.toContain("retiro");
  });

  it("envio_propio requiere ofrece_envio Y un costo_envio_propio no nulo", () => {
    expect(
      modalidadesDisponibles(
        { ...vianderaBase, ofrece_envio: true, costo_envio_propio: 600 },
        null,
      ),
    ).toContain("envio_propio");
    // Caso corregido en esta revisión: ofrece_envio=true pero sin costo
    // cargado NO habilita la modalidad.
    expect(
      modalidadesDisponibles({ ...vianderaBase, ofrece_envio: true }, null),
    ).not.toContain("envio_propio");
  });

  it("envio_propio con costo 0 (gratis explicito) SI esta disponible", () => {
    expect(
      modalidadesDisponibles(
        { ...vianderaBase, ofrece_envio: true, costo_envio_propio: 0 },
        null,
      ),
    ).toContain("envio_propio");
  });

  it("envio_puni requiere estado aprobada Y costo_envio_puni cargado", () => {
    expect(
      modalidadesDisponibles(vianderaBase, { estado: "aprobada", costo_envio_puni: 500 }),
    ).toContain("envio_puni");
    // Caso corregido en esta revisión: aprobada pero sin costo cargado
    // todavia NO habilita la modalidad.
    expect(
      modalidadesDisponibles(vianderaBase, { estado: "aprobada", costo_envio_puni: null }),
    ).not.toContain("envio_puni");
    expect(
      modalidadesDisponibles(vianderaBase, { estado: "pendiente", costo_envio_puni: null }),
    ).not.toContain("envio_puni");
    expect(modalidadesDisponibles(vianderaBase, null)).not.toContain("envio_puni");
  });

  it("devuelve array vacio si la cocina no ofrece nada utilizable", () => {
    expect(modalidadesDisponibles(vianderaBase, null)).toEqual([]);
  });
});

describe("costoEnvioVigente", () => {
  it("retiro siempre cuesta 0", () => {
    expect(costoEnvioVigente("retiro", vianderaBase, null)).toBe(0);
  });

  it("envio_propio usa costo_envio_propio, incluido null", () => {
    expect(
      costoEnvioVigente("envio_propio", { ...vianderaBase, costo_envio_propio: 600 }, null),
    ).toBe(600);
    expect(costoEnvioVigente("envio_propio", vianderaBase, null)).toBeNull();
  });

  it("envio_puni usa el costo_envio_puni cargado por la vendedora", () => {
    expect(
      costoEnvioVigente("envio_puni", vianderaBase, {
        estado: "aprobada",
        costo_envio_puni: 700,
      }),
    ).toBe(700);
    expect(
      costoEnvioVigente("envio_puni", vianderaBase, {
        estado: "aprobada",
        costo_envio_puni: null,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Paso 6: Implementación mínima** — la diferencia clave respecto a
  la versión anterior de este plan: `modalidadesDisponibles` ahora exige
  costo no-nulo, no solo el flag booleano/estado.

```ts
// lib/envios/modalidades.ts
export type Modalidad = "retiro" | "envio_propio" | "envio_puni";

type VianderaEnvio = {
  ofrece_retiro: boolean;
  ofrece_envio: boolean;
  costo_envio_propio: number | null;
};

type AdhesionResumen = {
  estado: "pendiente" | "aprobada" | "rechazada" | "suspendida" | "revocada";
  costo_envio_puni: number | null;
} | null;

export function costoEnvioVigente(
  modalidad: Modalidad,
  viandera: VianderaEnvio,
  adhesion: AdhesionResumen,
): number | null {
  if (modalidad === "retiro") return 0;
  if (modalidad === "envio_propio") return viandera.costo_envio_propio;
  return adhesion?.costo_envio_puni ?? null;
}

export function modalidadesDisponibles(
  viandera: VianderaEnvio,
  adhesion: AdhesionResumen,
): Modalidad[] {
  const candidatas: Modalidad[] = [];
  if (viandera.ofrece_retiro) candidatas.push("retiro");
  if (viandera.ofrece_envio) candidatas.push("envio_propio");
  if (adhesion?.estado === "aprobada") candidatas.push("envio_puni");

  return candidatas.filter(
    (modalidad) => costoEnvioVigente(modalidad, viandera, adhesion) !== null,
  );
}
```

- [ ] **Paso 7: Correr los tests, confirmar que pasan.**

- [ ] **Paso 8: Commit**

```bash
git add lib/envios/
git commit -m "feat: add pure shipping-modality logic that excludes null-cost options"
```

---

### Task 3: Server Actions de vendedora (solicitar adhesión, configurar costo, guardar envío)

**Files:**
- Modify: `app/viandera/actions.ts` (extender `actualizarPerfil`, agregar
  `solicitarAdhesionPuni` y **`actualizarCostoEnvioPuni`**, nueva en esta
  revisión)

**Interfaces:**
- Consume: `transicionValida` (Task 2).

- [ ] **Paso 1: Extender `actualizarPerfil`** — sin cambios respecto a la
  versión anterior de este plan.

- [ ] **Paso 2: `solicitarAdhesionPuni`** — sin cambios respecto a la
  versión anterior de este plan (sigue usando `createClient()`, no
  `createAdminClient()` — la RLS ya garantiza que solo llega a
  `pendiente`).

- [ ] **Paso 3: `actualizarCostoEnvioPuni`** (nueva)

```ts
export type ResultadoActualizarCostoPuni =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function actualizarCostoEnvioPuni(
  _prevState: ResultadoActualizarCostoPuni,
  formData: FormData,
): Promise<ResultadoActualizarCostoPuni> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", mensaje: "No autenticado." };

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!viandera) return { status: "error", mensaje: "No encontramos tu cocina." };

  const { data: adhesion } = await supabase
    .from("puni_adhesiones")
    .select("estado")
    .eq("viandera_id", viandera.id)
    .maybeSingle();

  if (adhesion?.estado !== "aprobada") {
    return { status: "error", mensaje: "Tu adhesión todavía no está aprobada." };
  }

  const costoRaw = String(formData.get("costoEnvioPuni") ?? "").trim();
  const costo = costoRaw ? Number(costoRaw) : null;
  if (costoRaw && (Number.isNaN(costo) || (costo as number) < 0)) {
    return { status: "error", mensaje: "Costo inválido." };
  }

  // Vía RLS (createClient, no admin) — el trigger de la Task 1 ya
  // garantiza que esta sesión, sin ser service_role, solo puede tocar
  // costo_envio_puni mientras estado sigue en 'aprobada'.
  const { error } = await supabase
    .from("puni_adhesiones")
    .update({ costo_envio_puni: costo, estado: "aprobada" })
    .eq("viandera_id", viandera.id);

  if (error) return { status: "error", mensaje: "No pudimos guardar el costo." };
  revalidatePath("/viandera/perfil");
  return { status: "ok" };
}
```

Nota: `estado: "aprobada"` se reenvía sin cambio en el `update` a
propósito — el trigger de la Task 1 compara `old.estado = new.estado =
'aprobada'` para permitir el caso 2; omitir el campo dejaría a Supabase
sin tocarlo (lo cual también sería válido), pero enviarlo explícito hace
la intención legible en el código.

- [ ] **Paso 4: Tests** — sin usuario autenticado devuelve error; sin
  adhesión aprobada devuelve error sin intentar el update (mock que
  falla si se invoca); costo negativo o no numérico rechazado antes de
  tocar la base.

- [ ] **Paso 5: Commit**

```bash
git add app/viandera/actions.ts app/viandera/actions.test.ts
git commit -m "feat: let sellers request Puni adhesion and set their own Puni shipping cost"
```

---

### Task 4: Server Actions de admin (aprobar/rechazar/suspender/revocar — sin costo)

**Files:**
- Modify: `app/admin/actions.ts`

**Interfaces:**
- Consume: `esAdmin`, `createAdminClient` (existentes), `transicionValida`
  (Task 2).

- [ ] **Paso 1: `resolverAdhesionPuni`** — versión corregida: **no acepta
  ni procesa `costoEnvioPuni`** en ningún caso, ni siquiera al aprobar.

```ts
export type ResultadoResolverAdhesion =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function resolverAdhesionPuni(
  _prevState: ResultadoResolverAdhesion,
  formData: FormData,
): Promise<ResultadoResolverAdhesion> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const adhesionId = String(formData.get("adhesionId") ?? "");
  const nuevoEstado = String(formData.get("estado") ?? "") as EstadoAdhesionPuni;
  const notaAdmin = String(formData.get("notaAdmin") ?? "").trim() || null;

  if (!adhesionId || !nuevoEstado) {
    return { status: "error", mensaje: "Faltan datos." };
  }

  const admin = createAdminClient();
  const { data: actual } = await admin
    .from("puni_adhesiones")
    .select("estado")
    .eq("id", adhesionId)
    .single();
  if (!actual) return { status: "error", mensaje: "Solicitud no encontrada." };

  if (!transicionValida(actual.estado, nuevoEstado, "admin")) {
    return { status: "error", mensaje: "Esa transición no es válida desde el estado actual." };
  }

  const { error } = await admin
    .from("puni_adhesiones")
    .update({
      estado: nuevoEstado,
      nota_admin: notaAdmin,
      resuelto_en: new Date().toISOString(),
      resuelto_por: user!.email,
    })
    .eq("id", adhesionId);

  if (error) return { status: "error", mensaje: "No pudimos guardar el cambio." };

  revalidatePath("/admin");
  return { status: "ok" };
}
```

- [ ] **Paso 2: Test — un usuario no-admin no puede resolver** — sin
  cambios respecto a la versión anterior.

- [ ] **Paso 3: Test de integración (Task 0 del plan de Carrito) —
  imposibilidad de auto-aprobarse**: con un cliente autenticado como la
  vendedora (no `service_role`), un `update` directo a `puni_adhesiones`
  intentando `estado = 'aprobada'` (desde `pendiente` o desde cualquier
  otro estado) debe fallar por el trigger de la Task 1 — no alcanza con
  probarlo solo a través de la Server Action, hay que confirmar que la
  base lo rechaza aunque alguien bypasee la Server Action por completo.

- [ ] **Paso 4: Commit**

```bash
git add app/admin/actions.ts app/admin/actions.test.ts
git commit -m "feat: add admin action to resolve Puni adhesion requests without setting cost"
```

---

### Task 5: UI de vendedora — envío y adhesión en `/viandera/perfil`

**Files:**
- Modify: `components/viandera/FormularioPerfil.tsx`
- Create: `components/viandera/FormularioCostoPuni.tsx` (nuevo,
  desacoplado del resto del perfil — su propio `useActionState` con
  `actualizarCostoEnvioPuni`)
- Modify: `app/viandera/perfil/page.tsx`

**Interfaces:**
- Consume: `actualizarPerfil` extendido, `solicitarAdhesionPuni`,
  `actualizarCostoEnvioPuni` (Task 3).

- [ ] **Paso 1: Campos de retiro/envío propio** — sin cambios respecto a
  la versión anterior de este plan, con una aclaración de copy: el campo
  de costo vacío debe decir explícitamente algo como "sin cargar — esta
  modalidad no va a aparecer en el carrito hasta que cargues un costo"
  (ya no se llama "a coordinar", para no sugerir que es una opción usable
  con ese estado).

- [ ] **Paso 2: Sección "Envío mediante Puni"**:
  - Sin solicitud / `pendiente` / `rechazada` / `revocada` / `suspendida`:
    igual a la versión anterior de este plan.
  - **`aprobada`** (corregido): en vez de mostrar el costo de solo
    lectura, monta `FormularioCostoPuni` — un campo numérico editable +
    botón "Guardar costo", con el mismo texto de advertencia de "sin
    costo cargado, esta modalidad no aparece en el carrito de tus
    compradores" cuando está vacío.

- [ ] **Paso 3: Verificar responsive** 375/768/1024/1440px.

- [ ] **Paso 4: Commit**

```bash
git add components/viandera/FormularioPerfil.tsx components/viandera/FormularioCostoPuni.tsx app/viandera/perfil/page.tsx
git commit -m "feat: let sellers configure their own Puni shipping cost from their profile"
```

---

### Task 6: UI de admin — resolver solicitudes en `/admin` (sin costo)

**Files:**
- Modify: `app/admin/page.tsx`
- Create: `components/admin/TarjetaSolicitudPuni.tsx`

**Interfaces:**
- Consume: `resolverAdhesionPuni` (Task 4).

- [ ] **Paso 1: Sección nueva en `/admin`** — igual a la versión anterior
  de este plan.

- [ ] **Paso 2: Formulario de aprobación** (corregido): **sin campo de
  costo**. Aprobar es una acción de un solo clic (más un campo opcional
  de nota si se rechaza) — el admin no carga ningún número de Puni.

- [ ] **Paso 3: Commit**

```bash
git add app/admin/page.tsx components/admin/TarjetaSolicitudPuni.tsx
git commit -m "feat: add admin UI to approve or reject Puni adhesion requests"
```

---

### Task 7: Superficie pública server-only + insignia "Adherido a Puni"

**Files:**
- Create: `lib/envios/adhesionPublica.ts` (nuevo — reemplaza la vista
  pública de la revisión anterior)
- Create: `lib/envios/adhesionPublica.test.ts`
- Modify: `lib/viandas/consultas.ts` (usar `adhesionesAprobadas` en vez
  de un join a una vista, en `buscarPlatos`)
- Modify: `app/[slug]/page.tsx`
- Modify: `components/consumer/DishCard.tsx` y
  `components/storefront/StorefrontHeader.tsx`

**Interfaces:**
- Consume: `createAdminClient` (existente).
- Produce: `adhesionesAprobadas` — usado también por la Server Action
  `generarPedido` del plan de Carrito y pedidos para resolver el costo de
  "envío mediante Puni".

- [ ] **Paso 1: `adhesionPublica.ts`**

```ts
// lib/envios/adhesionPublica.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdhesionAprobada = { viandera_id: string; costo_envio_puni: number | null };

export async function adhesionesAprobadas(
  vianderaIds: string[],
): Promise<Map<string, AdhesionAprobada>> {
  if (vianderaIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("puni_adhesiones")
    .select("viandera_id, costo_envio_puni")
    .eq("estado", "aprobada")
    .in("viandera_id", vianderaIds);

  if (error) {
    console.error("[envios] fallo al consultar adhesiones aprobadas", error);
    return new Map();
  }

  return new Map((data ?? []).map((fila) => [fila.viandera_id, fila]));
}
```

Nota deliberada: el `select` explícito de dos columnas es en sí mismo el
control de seguridad — nunca `select('*')` en este archivo, y este
archivo es el **único** lugar del código que consulta `puni_adhesiones`
para lectura pública (todo lo demás pasa por acá, no se repite la
consulta en cada componente).

- [ ] **Paso 2: Test** — mockeando `createAdminClient`, confirmar que el
  resultado nunca contiene una clave que no sea `viandera_id` o
  `costo_envio_puni` (recorrer `Object.keys` de cada valor del Map y
  comparar contra el set exacto `{viandera_id, costo_envio_puni}` — un
  test que fallaría si alguien más adelante cambiara el `select` a `*`
  por error).

- [ ] **Paso 3: Extender `buscarPlatos`** — llamar `adhesionesAprobadas`
  con las `vianderas_id` ya resueltas, anexar `adheridaAPuni: boolean` y
  `costoEnvioPuni: number | null` al resultado.

- [ ] **Paso 4: Insignia visual** — igual a la versión anterior de este
  plan (ícono propio, nunca emoji).

- [ ] **Paso 5: Test de `buscarPlatos`** — `adheridaAPuni` es `true` solo
  cuando `adhesionesAprobadas` devuelve una entrada para esa viandera.

- [ ] **Paso 6: Test de integración (Task 0 del plan de Carrito) —
  imposibilidad de leer `nota_admin` públicamente**: con la `anon key`
  (sin sesión autenticada), cualquier `select` contra `puni_adhesiones`
  — incluido uno que pida `nota_admin` explícitamente — debe devolver
  cero filas (confirmando que no hay ninguna policy de RLS que lo
  permita, no solo que la función `adhesionesAprobadas` no lo pida).

- [ ] **Paso 7: Commit**

```bash
git add lib/envios/adhesionPublica.ts lib/envios/adhesionPublica.test.ts lib/viandas/consultas.ts app/[slug]/page.tsx components/consumer/DishCard.tsx components/storefront/StorefrontHeader.tsx components/landing/icons.tsx
git commit -m "feat: show public Puni adhesion badge via a server-only, column-limited query"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] `select * from pg_policies where tablename = 'puni_adhesiones'`
  muestra únicamente las tres policies de la vendedora (select propia,
  insert propia, update propia) — **cero** policies para `anon` o con
  `to authenticated` sin scoping por `user_id`.
- [ ] Ninguna vista pública existe sobre `puni_adhesiones` (`select *
  from information_schema.views where table_name like 'puni%'` no debe
  devolver nada, o si algo existe, confirmar que no es accesible por
  `anon`).
- [ ] Trigger `puni_adhesiones_validar_update_vendedora` probado con test
  de integración, no solo confiado por lectura del código: (a) intento de
  auto-aprobarse falla, (b) actualizar costo mientras aprobada funciona y
  no permite colar un cambio a `nota_admin` en la misma operación.
- [ ] `resolverAdhesionPuni` (admin) no acepta ni procesa
  `costoEnvioPuni` en ningún branch del código.
- [ ] `actualizarCostoEnvioPuni` (vendedora) rechaza si la adhesión no
  está `aprobada`, antes de cualquier intento de `update`.
- [ ] `lib/envios/adhesionPublica.ts` es el único lugar del código que
  lee `puni_adhesiones` para propósito público, y su `select` nunca pide
  `nota_admin`/`resuelto_por`/`resuelto_en`/`estado` real (confirmado por
  el test del Paso 2 de la Task 7).
- [ ] `costo_envio_propio`/`costo_envio_puni` tienen `check (>= 0)`.
- [ ] Ningún dato de Puni (nombre, condiciones) se inventa en la UI —
  el costo lo carga la vendedora después de acordarlo con Puni fuera de
  ViandApp, nunca un valor de ejemplo hardcodeado.

## QA responsive

- [ ] `/viandera/perfil`: 375, 768, 1024, 1440px — formulario, sección de
  adhesión, y el nuevo `FormularioCostoPuni` sin scroll horizontal,
  campos ≥44px.
- [ ] `/admin`: nueva sección de solicitudes (sin campo de costo en el
  formulario de aprobación), mismos breakpoints.
- [ ] Insignia pública en `/explorar` y `/{slug}`: sin salto de layout.

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** Al terminar las Tasks 1-7, detenerse y reportar: qué
se implementó, resultado de tests (unitarios e integración), y cualquier
desvío del plan y por qué.
