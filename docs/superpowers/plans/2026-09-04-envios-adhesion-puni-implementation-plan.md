# Configuración de envíos y adhesión a Puni — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL: usar
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans` para implementar tarea por tarea. Los pasos
> usan sintaxis de checkbox (`- [ ]`).

**Segunda revisión correctiva 2026-09-04** sobre el commit `2ee4acc`:
`puni_adhesiones` pasa a tener **RLS habilitado sin ninguna policy, para
nadie** — se elimina el acceso directo de la vendedora a su propia fila
(Task 1: se quitan las tres policies y el trigger de la revisión
anterior). Toda lectura/escritura de la vendedora pasa por Server Actions
que verifican propiedad en código y usan `createAdminClient()` con
proyecciones explícitas (Task 3, Task 5).

**Objetivo:** exponer retiro/envío propio (costo, cobertura) en el perfil
de viandera, y un flujo de solicitud/aprobación de adhesión a Puni donde
el admin solo verifica y resuelve el estado — la vendedora configura el
costo que cobra por esa modalidad.

**Arquitectura:** dos columnas nuevas en `vianderas` + una tabla nueva
`puni_adhesiones` con RLS habilitado y **cero policies** — ni admin ni
vendedora acceden vía RLS, todo pasa por `createAdminClient()` desde
Server Actions que verifican ownership en código (mismo patrón que las
tablas de CRM). Dos proyecciones server-only con columnas explícitas:
`adhesionesAprobadas` (pública, para insignia/carrito) y
`obtenerAdhesionPropia` (para la vendedora, sin `resuelto_por`/
`resuelto_en`).

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS, Vitest + Vitest de integración (Task 0 del plan de Carrito y
pedidos, reutilizada).

**Spec:** `docs/superpowers/specs/2026-09-04-envios-adhesion-puni-design.md`

**Requiere PRIMERO (fuera de este plan, antes de la Task 1):** confirmar en
el Supabase Dashboard qué plan tiene el proyecto y si existe backup
restaurable — mismo preflight que el resto de las migraciones del
proyecto.

## Global Constraints

- No tocar Supabase hasta que Codex revise este plan.
- RLS habilitado en `puni_adhesiones` desde el `create table` mismo.
  **Cero policies, para nadie** — ni admin ni vendedora tienen un camino
  de acceso vía RLS. Toda operación pasa por `createAdminClient()` desde
  una Server Action que verificó ownership/autorización en código.
- La vendedora NUNCA puede escribir `estado = 'aprobada'` — no hay
  ningún camino de escritura directa desde su sesión bajo ninguna
  circunstancia, ni siquiera restringido por trigger (no hace falta:
  no hay RLS que bypasear).
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
-- Sin ninguna policy: ni admin ni vendedora acceden vía RLS. Toda
-- operación pasa por createAdminClient() desde Server Actions que
-- verifican ownership/autorización en código (Task 3, Task 5). No hace
-- falta un trigger de validación de update: no hay ningún camino de
-- escritura directa que ese trigger tuviera que defender.

drop trigger if exists puni_adhesiones_set_updated_at on public.puni_adhesiones;
create trigger puni_adhesiones_set_updated_at
before update on public.puni_adhesiones
for each row execute function public.viandapp_set_updated_at();

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

### Task 3: `lib/envios/adhesionPropia.ts` + Server Actions de vendedora

**Files:**
- Create: `lib/envios/adhesionPropia.ts`, `lib/envios/adhesionPropia.test.ts`
- Modify: `app/viandera/actions.ts` (extender `actualizarPerfil`, agregar
  `obtenerEstadoAdhesionPropia`, `solicitarAdhesionPuni`,
  `actualizarCostoEnvioPuni` — **las tres reescritas en esta revisión
  para usar `createAdminClient()` con verificación de ownership en
  código, ya que no hay más RLS que las respalde**)

**Interfaces:**
- Consume: `transicionValida` (Task 2).

- [ ] **Paso 1: Extender `actualizarPerfil`** — sin cambios respecto a la
  versión anterior de este plan (sigue usando `createClient()`/RLS
  normal — `vianderas` no cambió su modelo de acceso).

- [ ] **Paso 2: `adhesionPropia.ts`**

```ts
// lib/envios/adhesionPropia.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EstadoAdhesionPuni } from "./transiciones";

export type EstadoAdhesionVendedora = {
  estado: EstadoAdhesionPuni;
  costoEnvioPuni: number | null;
  notaAdmin: string | null;
};

export async function obtenerAdhesionPropia(
  vianderaId: string,
): Promise<EstadoAdhesionVendedora | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("puni_adhesiones")
    .select("estado, costo_envio_puni, nota_admin")
    .eq("viandera_id", vianderaId)
    .maybeSingle();
  if (!data) return null;
  return {
    estado: data.estado,
    costoEnvioPuni: data.costo_envio_puni,
    notaAdmin: data.nota_admin,
  };
}
```

- [ ] **Paso 3: Test de `adhesionPropia.ts`** — el resultado nunca tiene
  una clave `resuelto_por` ni `resuelto_en` (recorrer `Object.keys`,
  comparar contra `{estado, costoEnvioPuni, notaAdmin}` exacto).

- [ ] **Paso 4: `obtenerEstadoAdhesionPropia`, `solicitarAdhesionPuni`,
  `actualizarCostoEnvioPuni`** — las tres siguen el mismo patrón: resolver
  identidad, resolver `vianderaId` propio, y recién ahí usar
  `createAdminClient()`.

```ts
async function resolverVianderaPropia(): Promise<
  { ok: true; vianderaId: string } | { ok: false; mensaje: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "No autenticado." };

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!viandera) return { ok: false, mensaje: "No encontramos tu cocina." };

  return { ok: true, vianderaId: viandera.id };
}

export async function obtenerEstadoAdhesionPropia(): Promise<EstadoAdhesionVendedora | null> {
  const propia = await resolverVianderaPropia();
  if (!propia.ok) return null;
  return obtenerAdhesionPropia(propia.vianderaId);
}

export type ResultadoSolicitudAdhesion =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function solicitarAdhesionPuni(
  _prevState: ResultadoSolicitudAdhesion,
  _formData: FormData,
): Promise<ResultadoSolicitudAdhesion> {
  const propia = await resolverVianderaPropia();
  if (!propia.ok) return { status: "error", mensaje: propia.mensaje };

  const admin = createAdminClient();
  const existente = await obtenerAdhesionPropia(propia.vianderaId);

  if (!existente) {
    const { error } = await admin
      .from("puni_adhesiones")
      .insert({ viandera_id: propia.vianderaId, estado: "pendiente" });
    if (error) return { status: "error", mensaje: "No pudimos enviar la solicitud." };
    revalidatePath("/viandera/perfil");
    return { status: "ok" };
  }

  if (!transicionValida(existente.estado, "pendiente", "viandera")) {
    return { status: "error", mensaje: "No podés volver a solicitar desde el estado actual." };
  }

  const { error } = await admin
    .from("puni_adhesiones")
    .update({ estado: "pendiente" })
    .eq("viandera_id", propia.vianderaId);
  if (error) return { status: "error", mensaje: "No pudimos reenviar la solicitud." };
  revalidatePath("/viandera/perfil");
  return { status: "ok" };
}

export type ResultadoActualizarCostoPuni =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function actualizarCostoEnvioPuni(
  _prevState: ResultadoActualizarCostoPuni,
  formData: FormData,
): Promise<ResultadoActualizarCostoPuni> {
  const propia = await resolverVianderaPropia();
  if (!propia.ok) return { status: "error", mensaje: propia.mensaje };

  const actual = await obtenerAdhesionPropia(propia.vianderaId);
  if (actual?.estado !== "aprobada") {
    return { status: "error", mensaje: "Tu adhesión todavía no está aprobada." };
  }

  const costoRaw = String(formData.get("costoEnvioPuni") ?? "").trim();
  const costo = costoRaw ? Number(costoRaw) : null;
  if (costoRaw && (Number.isNaN(costo) || (costo as number) < 0)) {
    return { status: "error", mensaje: "Costo inválido." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("puni_adhesiones")
    .update({ costo_envio_puni: costo })
    .eq("viandera_id", propia.vianderaId);

  if (error) return { status: "error", mensaje: "No pudimos guardar el costo." };
  revalidatePath("/viandera/perfil");
  return { status: "ok" };
}
```

  Nota: `resolverVianderaPropia` **siempre** resuelve el `vianderaId`
  del usuario autenticado — ninguna de estas tres funciones acepta un
  `vianderaId` como parámetro externo, así que no existe ningún request
  que pueda operar sobre la fila de otra vendedora.

- [ ] **Paso 5: Tests** — sin usuario autenticado devuelve error sin
  llamar `createAdminClient` (spy); sin adhesión aprobada,
  `actualizarCostoEnvioPuni` devuelve error sin intentar el `update`;
  `solicitarAdhesionPuni` con una adhesión `aprobada` existente rechaza
  (transición inválida) sin escribir.

- [ ] **Paso 6: Commit**

```bash
git add lib/envios/adhesionPropia.ts lib/envios/adhesionPropia.test.ts app/viandera/actions.ts app/viandera/actions.test.ts
git commit -m "feat: replace direct RLS access with ownership-checked server actions for Puni adhesion"
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
  vendedora (`authenticated`, no `service_role`), **cualquier**
  `update`/`insert`/`select` directo contra `puni_adhesiones` debe
  fallar o devolver cero filas — no hay ninguna policy de RLS que dé
  acceso a nadie salvo `service_role`, así que no hace falta un trigger
  que valide "qué transición es válida para esta sesión": la sesión no
  tiene acceso de tabla en absoluto. El test confirma esa ausencia total
  de acceso, no un caso límite de una policy.

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
- Consume: `actualizarPerfil` extendido, `obtenerEstadoAdhesionPropia`,
  `solicitarAdhesionPuni`, `actualizarCostoEnvioPuni` (Task 3).

- [ ] **Paso 0 (nuevo en esta revisión): `app/viandera/perfil/page.tsx`
  ya no consulta `puni_adhesiones` con un cliente Supabase autenticado
  (no hay RLS que se lo permita) — llama
  `obtenerEstadoAdhesionPropia()` (Server Action de Task 3) y pasa el
  resultado como prop a los componentes de esta página.

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
  devuelve **cero filas** — ni admin ni vendedora tienen ninguna policy,
  la tabla es 100% `service_role`-only.
- [ ] Ninguna vista pública existe sobre `puni_adhesiones`.
- [ ] Test de integración confirma que una sesión `authenticated` (la
  propia vendedora dueña de una fila, o cualquier otra) no puede leer ni
  escribir la tabla directamente, bajo ninguna operación.
- [ ] `resolverAdhesionPuni` (admin) no acepta ni procesa
  `costoEnvioPuni` en ningún branch del código.
- [ ] `actualizarCostoEnvioPuni` (vendedora) rechaza si la adhesión no
  está `aprobada`, antes de cualquier intento de `update` — y resuelve
  el `vianderaId` siempre del usuario autenticado, nunca de un parámetro
  externo.
- [ ] `obtenerAdhesionPropia` nunca devuelve `resuelto_por` ni
  `resuelto_en` (confirmado por el test de la Task 3, Paso 3).
- [ ] `lib/envios/adhesionPublica.ts` es el único lugar del código que
  lee `puni_adhesiones` para propósito público, y su `select` nunca pide
  `nota_admin`/`resuelto_por`/`resuelto_en`/`estado` real.
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
