# Configuración de envíos y adhesión a Puni — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL: usar
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans` para implementar tarea por tarea. Los pasos
> usan sintaxis de checkbox (`- [ ]`).

**Objetivo:** exponer retiro/envío propio (costo, cobertura) en el perfil
de viandera, y un flujo de solicitud/aprobación de adhesión a Puni que solo
el admin puede resolver.

**Arquitectura:** dos columnas nuevas en `vianderas` + una tabla nueva
`puni_adhesiones` con RLS de dos capas (la vendedora solo puede llegar a
`pendiente`, el admin resuelve el resto vía `createAdminClient()`). Una
vista pública mínima (`puni_adhesion_publica`) para la insignia.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-envios-adhesion-puni-design.md`

**Requiere PRIMERO (fuera de este plan, antes de la Task 1):** confirmar en
el Supabase Dashboard qué plan tiene el proyecto y si existe backup
restaurable, exactamente el mismo preflight que ya se documentó para la
migración del explorador (`CLAUDE.md`, sección "Migración de datos
versionada") — esta migración también es aditiva (sin `drop`), pero el
preflight de backup no se salta por eso.

## Global Constraints

- No tocar Supabase hasta que Codex revise este plan — ninguna tarea se
  ejecuta todavía.
- RLS habilitado en `puni_adhesiones` desde el `create table` mismo, nunca
  como paso posterior.
- La vendedora NUNCA puede escribir `estado = 'aprobada'` — ni por policy
  de RLS ni por ningún Server Action expuesto a su sesión.
- Las transiciones de admin (`aprobada`/`rechazada`/`suspendida`/
  `revocada`) usan `createAdminClient()` gateado por `esAdmin(user?.email)`
  — mismo patrón exacto que `invitarViandera` en `app/admin/actions.ts`.
- `nota_admin` nunca se expone en ninguna vista ni policy pública.
- Sin nuevas dependencias de npm.
- Cada ruta raíz nueva se suma a `RUTAS_RESERVADAS`
  (`lib/viandera/slug.ts`) — esta entrega no agrega rutas raíz nuevas, así
  que no aplica, pero queda documentado por si el plan de Alianza Puni
  decide una ruta propia.
- Todas las funciones puras de negocio (transiciones válidas, modalidades
  disponibles, costo vigente) se escriben con TDD: test que falla primero,
  implementación mínima después.

---

### Task 1: Migración — columnas de envío en `vianderas` + tabla `puni_adhesiones`

**Files:**
- Create: `supabase/migrations/202609040001_envios_adhesion_puni.sql`
- Modify: `types/index.ts:13-28` (agregar campos a `Viandera`, agregar tipo
  `PuniAdhesion` y su entrada en `Database.public.Tables`)

**Interfaces:**
- Produce: tablas `vianderas` (extendida) y `puni_adhesiones`, vista
  `puni_adhesion_publica` — consumidas por las Tasks 2-6 y por el plan de
  Carrito y pedidos.

- [ ] **Paso 1: Escribir la migración**

```sql
-- Envíos a nivel de cocina + adhesión administrada a Puni.
-- Aditiva: sin drop de tablas/columnas. Repetible (if not exists / or replace).
-- Preflight de backup ya confirmado fuera de este script (ver plan).

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

-- Bloquea que una sesión sin service role toque cualquier columna que no
-- sea `estado` (y solo en la transición rechazada/revocada -> pendiente).
create or replace function public.puni_adhesiones_bloquear_campos_no_admin()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if old.estado not in ('rechazada', 'revocada') or new.estado != 'pendiente' then
    raise exception 'transicion no permitida para esta sesion';
  end if;

  if new.costo_envio_puni is distinct from old.costo_envio_puni
     or new.nota_admin is distinct from old.nota_admin
     or new.resuelto_por is distinct from old.resuelto_por
     or new.resuelto_en is distinct from old.resuelto_en
     or new.viandera_id is distinct from old.viandera_id then
    raise exception 'solo se puede modificar el estado';
  end if;

  return new;
end;
$$;

drop trigger if exists puni_adhesiones_bloquear_campos on public.puni_adhesiones;
create trigger puni_adhesiones_bloquear_campos
before update on public.puni_adhesiones
for each row execute function public.puni_adhesiones_bloquear_campos_no_admin();

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

create policy "viandera re-solicita adhesion"
  on public.puni_adhesiones for update
  using (
    viandera_id in (select id from public.vianderas where user_id = auth.uid())
    and estado in ('rechazada', 'revocada')
  )
  with check (estado = 'pendiente');

create policy "cualquiera ve adhesiones aprobadas"
  on public.puni_adhesiones for select
  to anon, authenticated
  using (estado = 'aprobada');

create view public.puni_adhesion_publica
with (security_invoker = true) as
select viandera_id, costo_envio_puni
from public.puni_adhesiones
where estado = 'aprobada';

commit;
```

- [ ] **Paso 2: Actualizar `types/index.ts`**

Agregar a `Viandera`: `costo_envio_propio: number | null;` y
`cobertura_envio: string | null;`. Agregar tipo nuevo:

```ts
export type EstadoAdhesionPuni =
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "suspendida"
  | "revocada";

export type PuniAdhesion = {
  id: string;
  viandera_id: string;
  estado: EstadoAdhesionPuni;
  costo_envio_puni: number | null;
  solicitado_en: string;
  resuelto_en: string | null;
  resuelto_por: string | null;
  nota_admin: string | null;
  created_at: string;
  updated_at: string;
};
```

Y la entrada `puni_adhesiones` en `Database.public.Tables` siguiendo
exactamente el patrón de `vianderas` (Insert omite `id`/`created_at`/
`updated_at`, con los campos resueltos por admin como `Partial`).

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/202609040001_envios_adhesion_puni.sql types/index.ts
git commit -m "feat: add migration for shipping config and Puni adhesion"
```

**No aplicar la migración todavía** — queda en el repo hasta la
integración final aprobada (mismo criterio que
`202609030001_explorador_mvp.sql`, que sigue sin aplicar según
`CLAUDE.md`).

---

### Task 2: Funciones puras de negocio (TDD)

**Files:**
- Create: `lib/envios/modalidades.ts`
- Create: `lib/envios/modalidades.test.ts`
- Create: `lib/envios/transiciones.ts`
- Create: `lib/envios/transiciones.test.ts`

**Interfaces:**
- Produce: `modalidadesDisponibles`, `costoEnvioVigente`,
  `transicionValida` — consumidos por Tasks 3-6 y reexportados por el plan
  de Carrito y pedidos (no se duplica la implementación ahí).

- [ ] **Paso 1: Test de `transicionValida` (falla primero)**

```ts
// lib/envios/transiciones.test.ts
import { describe, expect, it } from "vitest";
import { transicionValida, type EstadoAdhesionPuni } from "./transiciones";

describe("transicionValida", () => {
  it("permite pendiente -> aprobada solo para admin", () => {
    expect(transicionValida("pendiente", "aprobada", "admin")).toBe(true);
    expect(transicionValida("pendiente", "aprobada", "viandera")).toBe(false);
  });

  it("permite pendiente -> rechazada solo para admin", () => {
    expect(transicionValida("pendiente", "rechazada", "admin")).toBe(true);
    expect(transicionValida("pendiente", "rechazada", "viandera")).toBe(false);
  });

  it("permite aprobada -> suspendida y aprobada -> revocada solo para admin", () => {
    expect(transicionValida("aprobada", "suspendida", "admin")).toBe(true);
    expect(transicionValida("aprobada", "revocada", "admin")).toBe(true);
    expect(transicionValida("aprobada", "suspendida", "viandera")).toBe(false);
  });

  it("permite suspendida -> aprobada y suspendida -> revocada solo para admin", () => {
    expect(transicionValida("suspendida", "aprobada", "admin")).toBe(true);
    expect(transicionValida("suspendida", "revocada", "admin")).toBe(true);
  });

  it("permite rechazada -> pendiente y revocada -> pendiente solo para viandera", () => {
    expect(transicionValida("rechazada", "pendiente", "viandera")).toBe(true);
    expect(transicionValida("revocada", "pendiente", "viandera")).toBe(true);
    expect(transicionValida("rechazada", "pendiente", "admin")).toBe(false);
  });

  it("rechaza cualquier transicion no listada", () => {
    expect(transicionValida("pendiente", "suspendida", "admin")).toBe(false);
    expect(transicionValida("aprobada", "pendiente", "admin")).toBe(false);
    expect(transicionValida("aprobada", "aprobada", "admin")).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr el test, confirmar que falla** (`transiciones.ts` no
  existe todavía).

- [ ] **Paso 3: Implementación mínima**

```ts
// lib/envios/transiciones.ts
export type EstadoAdhesionPuni =
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "suspendida"
  | "revocada";

type Quien = "admin" | "viandera";

const TRANSICIONES_ADMIN: Record<string, EstadoAdhesionPuni[]> = {
  pendiente: ["aprobada", "rechazada"],
  aprobada: ["suspendida", "revocada"],
  suspendida: ["aprobada", "revocada"],
};

const TRANSICIONES_VIANDERA: Record<string, EstadoAdhesionPuni[]> = {
  rechazada: ["pendiente"],
  revocada: ["pendiente"],
};

export function transicionValida(
  desde: EstadoAdhesionPuni,
  hacia: EstadoAdhesionPuni,
  quien: Quien,
): boolean {
  const tabla = quien === "admin" ? TRANSICIONES_ADMIN : TRANSICIONES_VIANDERA;
  return (tabla[desde] ?? []).includes(hacia);
}
```

- [ ] **Paso 4: Correr el test, confirmar que pasa.**

- [ ] **Paso 5: Test de `modalidadesDisponibles` y `costoEnvioVigente`
  (falla primero)**

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

  it("incluye envio_propio solo si ofrece_envio", () => {
    expect(modalidadesDisponibles({ ...vianderaBase, ofrece_envio: true }, null))
      .toContain("envio_propio");
  });

  it("incluye envio_puni solo si la adhesion esta aprobada", () => {
    expect(
      modalidadesDisponibles(vianderaBase, { estado: "aprobada", costo_envio_puni: 500 }),
    ).toContain("envio_puni");
    expect(
      modalidadesDisponibles(vianderaBase, { estado: "pendiente", costo_envio_puni: null }),
    ).not.toContain("envio_puni");
    expect(modalidadesDisponibles(vianderaBase, null)).not.toContain("envio_puni");
  });

  it("devuelve array vacio si la cocina no ofrece nada", () => {
    expect(modalidadesDisponibles(vianderaBase, null)).toEqual([]);
  });
});

describe("costoEnvioVigente", () => {
  it("retiro siempre cuesta 0", () => {
    expect(costoEnvioVigente("retiro", vianderaBase, null)).toBe(0);
  });

  it("envio_propio usa costo_envio_propio, o null si es a coordinar", () => {
    expect(
      costoEnvioVigente("envio_propio", { ...vianderaBase, costo_envio_propio: 600 }, null),
    ).toBe(600);
    expect(costoEnvioVigente("envio_propio", vianderaBase, null)).toBeNull();
  });

  it("envio_puni usa el costo_envio_puni de la adhesion aprobada", () => {
    expect(
      costoEnvioVigente("envio_puni", vianderaBase, {
        estado: "aprobada",
        costo_envio_puni: 700,
      }),
    ).toBe(700);
  });
});
```

- [ ] **Paso 6: Implementación mínima**

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

export function modalidadesDisponibles(
  viandera: VianderaEnvio,
  adhesion: AdhesionResumen,
): Modalidad[] {
  const modalidades: Modalidad[] = [];
  if (viandera.ofrece_retiro) modalidades.push("retiro");
  if (viandera.ofrece_envio) modalidades.push("envio_propio");
  if (adhesion?.estado === "aprobada") modalidades.push("envio_puni");
  return modalidades;
}

export function costoEnvioVigente(
  modalidad: Modalidad,
  viandera: VianderaEnvio,
  adhesion: AdhesionResumen,
): number | null {
  if (modalidad === "retiro") return 0;
  if (modalidad === "envio_propio") return viandera.costo_envio_propio;
  return adhesion?.costo_envio_puni ?? null;
}
```

- [ ] **Paso 7: Correr los tests, confirmar que pasan.**

- [ ] **Paso 8: Commit**

```bash
git add lib/envios/
git commit -m "feat: add pure shipping-modality and adhesion-transition logic with tests"
```

---

### Task 3: Server Actions de vendedora (solicitar/re-solicitar adhesión, guardar config de envío)

**Files:**
- Modify: `app/viandera/actions.ts` (agregar `actualizarPerfil` — extender
  la función existente con los campos nuevos — y agregar
  `solicitarAdhesionPuni`)

**Interfaces:**
- Consume: `transicionValida` (Task 2) para validar la re-solicitud antes
  de pegarle a la base (la RLS es la garantía real; esta llamada es para
  devolver un mensaje de error claro en vez de un error crudo de Postgres).
- Produce: `EstadoAdhesionPuni` (tipo de resultado del Server Action,
  distinto del tipo de dominio `EstadoAdhesionPuni` en `lib/envios` — si
  hay colisión de nombre, renombrar el de resultado a
  `ResultadoSolicitudAdhesion`).

- [ ] **Paso 1: Extender `actualizarPerfil` con los campos de envío**

Agregar lectura de `formData.get("ofrece_retiro")`,
`formData.get("ofrece_envio")`, `formData.get("costo_envio_propio")`
(string vacío → `null`, no `0`), `formData.get("cobertura_envio")` al
payload de `update` existente sobre `vianderas`. Validación: si
`ofrece_envio` es `false`, forzar `costo_envio_propio` y
`cobertura_envio` a `null` en el payload (evita guardar config de envío
"fantasma" que la UI ya no muestra).

- [ ] **Paso 2: `solicitarAdhesionPuni`**

```ts
export type ResultadoSolicitudAdhesion =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function solicitarAdhesionPuni(
  _prevState: ResultadoSolicitudAdhesion,
  _formData: FormData,
): Promise<ResultadoSolicitudAdhesion> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", mensaje: "No autenticado." };

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!viandera) return { status: "error", mensaje: "No encontramos tu cocina." };

  const { data: existente } = await supabase
    .from("puni_adhesiones")
    .select("estado")
    .eq("viandera_id", viandera.id)
    .maybeSingle();

  if (!existente) {
    const { error } = await supabase
      .from("puni_adhesiones")
      .insert({ viandera_id: viandera.id, estado: "pendiente" });
    if (error) return { status: "error", mensaje: "No pudimos enviar la solicitud." };
    revalidatePath("/viandera/perfil");
    return { status: "ok" };
  }

  if (!transicionValida(existente.estado, "pendiente", "viandera")) {
    return {
      status: "error",
      mensaje: "No podés volver a solicitar desde el estado actual.",
    };
  }

  const { error } = await supabase
    .from("puni_adhesiones")
    .update({ estado: "pendiente" })
    .eq("viandera_id", viandera.id);
  if (error) return { status: "error", mensaje: "No pudimos reenviar la solicitud." };
  revalidatePath("/viandera/perfil");
  return { status: "ok" };
}
```

Nota: este Server Action usa `createClient()` (respeta RLS), no
`createAdminClient()` — la RLS de `puni_adhesiones` ya garantiza que solo
puede llegar a `pendiente`; no hace falta escalar privilegios acá.

- [ ] **Paso 3: Tests de integración livianos**

`app/viandera/actions.test.ts` (si no existe, crearlo) — mockear
`createClient` para verificar: sin usuario autenticado devuelve error;
`transicionValida` rechaza una re-solicitud desde `aprobada` sin llegar a
tocar la base (test de la rama de error, con un mock de Supabase que
lanzaría si se llamara `update`).

- [ ] **Paso 4: Commit**

```bash
git add app/viandera/actions.ts app/viandera/actions.test.ts
git commit -m "feat: add seller-side shipping config and Puni adhesion request action"
```

---

### Task 4: Server Actions de admin (aprobar/rechazar/suspender/revocar)

**Files:**
- Modify: `app/admin/actions.ts`

**Interfaces:**
- Consume: `esAdmin` (existente), `createAdminClient` (existente),
  `transicionValida` (Task 2).

- [ ] **Paso 1: `resolverAdhesionPuni`**

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
  const costoEnvioPuniRaw = String(formData.get("costoEnvioPuni") ?? "").trim();

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

  if (nuevoEstado === "aprobada" && !costoEnvioPuniRaw) {
    return { status: "error", mensaje: "Cargá el costo de envío acordado con Puni." };
  }

  const { error } = await admin
    .from("puni_adhesiones")
    .update({
      estado: nuevoEstado,
      nota_admin: notaAdmin,
      resuelto_en: new Date().toISOString(),
      resuelto_por: user!.email,
      ...(nuevoEstado === "aprobada"
        ? { costo_envio_puni: Number(costoEnvioPuniRaw) }
        : {}),
    })
    .eq("id", adhesionId);

  if (error) return { status: "error", mensaje: "No pudimos guardar el cambio." };

  revalidatePath("/admin");
  return { status: "ok" };
}
```

- [ ] **Paso 2: Test — un usuario no-admin no puede resolver**

Mock de `supabase.auth.getUser()` devolviendo un email distinto de
`ADMIN_EMAIL`; verificar que la función devuelve `status: "error"` **sin**
haber llamado a `createAdminClient` (spy que falla el test si se invoca).

- [ ] **Paso 3: Commit**

```bash
git add app/admin/actions.ts app/admin/actions.test.ts
git commit -m "feat: add admin action to resolve Puni adhesion requests"
```

---

### Task 5: UI de vendedora — envío y adhesión en `/viandera/perfil`

**Files:**
- Modify: `components/viandera/FormularioPerfil.tsx`
- Modify: `app/viandera/perfil/page.tsx` (pasar los nuevos campos +
  resumen de adhesión como props)

**Interfaces:**
- Consume: `actualizarPerfil` extendido (Task 3), `solicitarAdhesionPuni`
  (Task 3).

- [ ] **Paso 1: Agregar al formulario** (siguiendo el mismo patrón visual
  de campos existentes: `label` + `campoClase`, o un toggle si el proyecto
  ya tiene un patrón de switch — si no, un checkbox estándar con
  `min-h-[44px]` en el área clickeable):
  - Checkbox "Ofrezco retiro" (`ofrece_retiro`).
  - Checkbox "Ofrezco envío propio" (`ofrece_envio`) que revela
    condicionalmente (mismo patrón de estado local que `ubicacion` en el
    componente) los campos costo y cobertura.
  - Input numérico "Costo de envío" con checkbox/toggle "A coordinar por
    WhatsApp" que, si está tildado, deshabilita y vacía el input (mapea a
    `null`).
  - Textarea "Zona de cobertura" (`cobertura_envio`).

- [ ] **Paso 2: Sección "Envío mediante Puni"** (fuera del `<form>`
  principal — es una acción propia con su propio Server Action, no un
  campo que se guarda junto al resto del perfil):
  - Si no hay `puni_adhesiones` para esta viandera: texto explicativo +
    botón "Solicitar adhesión a Puni" (usa `useActionState` con
    `solicitarAdhesionPuni`).
  - Si `estado = 'pendiente'`: "Tu solicitud está en revisión."
  - Si `estado = 'aprobada'`: "Adherida a Puni" + costo vigente
    (solo lectura).
  - Si `estado = 'rechazada'`/`'revocada'`: motivo si hay `nota_admin`, +
    botón para volver a solicitar.
  - Si `estado = 'suspendida'`: "Tu adhesión está suspendida temporalmente"
    — sin botón de acción (solo el admin puede reactivarla).

- [ ] **Paso 3: Verificar responsive** 375/768/1024/1440px, sin scroll
  horizontal, objetivos táctiles ≥44px.

- [ ] **Paso 4: Commit**

```bash
git add components/viandera/FormularioPerfil.tsx app/viandera/perfil/page.tsx
git commit -m "feat: expose shipping config and Puni adhesion request in seller profile"
```

---

### Task 6: UI de admin — resolver solicitudes en `/admin`

**Files:**
- Modify: `app/admin/page.tsx`
- Create: `components/admin/TarjetaSolicitudPuni.tsx`

**Interfaces:**
- Consume: `resolverAdhesionPuni` (Task 4).

- [ ] **Paso 1: Sección nueva en `/admin`** listando `puni_adhesiones` con
  `estado = 'pendiente'` primero (orden: pendientes, luego aprobadas,
  luego el resto) — un `TarjetaSolicitudPuni` por fila con nombre de la
  cocina (join a `vianderas.nombre`), fecha de solicitud, y los botones de
  acción correspondientes al estado actual (usar `transicionValida` en el
  cliente solo para decidir qué botones mostrar — la validación real sigue
  siendo server-side en la Task 4).

- [ ] **Paso 2: Formulario de aprobación** pide `costoEnvioPuni` (input
  numérico obligatorio) antes de habilitar el submit.

- [ ] **Paso 3: Commit**

```bash
git add app/admin/page.tsx components/admin/TarjetaSolicitudPuni.tsx
git commit -m "feat: add admin UI to resolve Puni adhesion requests"
```

---

### Task 7: Insignia pública "Adherido a Puni"

**Files:**
- Modify: `lib/viandas/consultas.ts` (sumar el join opcional a
  `puni_adhesion_publica` en `buscarPlatos`, exponer
  `viandera.adheridaAPuni: boolean` en `ResultadoPlato`)
- Modify: `app/[slug]/page.tsx` (mismo join para el perfil individual)
- Modify: `components/consumer/DishCard.tsx` y
  `components/storefront/StorefrontHeader.tsx` (mostrar la insignia)

**Interfaces:**
- Consume: vista `puni_adhesion_publica` (Task 1).

- [ ] **Paso 1: Extender `buscarPlatos`** con una tercera consulta (mismo
  patrón de "dos consultas separadas" ya usado, por la falta de metadata
  de relaciones en `Database`) a `puni_adhesion_publica`, filtrando por
  las `vianderas_id` ya resueltas, y anexar `adheridaAPuni` al resultado.

- [ ] **Paso 2: Insignia visual** — un badge chico, ícono propio
  (`components/landing/icons.tsx`, siguiendo el estilo de línea existente,
  **nunca emoji**) + texto "Adherido a Puni", visible en la tarjeta de
  resultado y en el encabezado del perfil público.

- [ ] **Paso 3: Test de `buscarPlatos`** — agregar un caso al test
  existente (si existe) o crear uno nuevo verificando que
  `adheridaAPuni` es `true` solo cuando hay una fila aprobada para esa
  viandera.

- [ ] **Paso 4: Commit**

```bash
git add lib/viandas/consultas.ts app/[slug]/page.tsx components/consumer/DishCard.tsx components/storefront/StorefrontHeader.tsx components/landing/icons.tsx
git commit -m "feat: show public Puni adhesion badge on storefront and search results"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] RLS habilitado en `puni_adhesiones`, sin policy que permita a la
  vendedora escribir `estado = 'aprobada'` bajo ninguna condición.
- [ ] Trigger `puni_adhesiones_bloquear_campos_no_admin` probado
  manualmente contra un intento de update directo (no solo confiar en la
  policy).
- [ ] `nota_admin` nunca alcanzable desde `anon`/`authenticated` (ni por
  policy, ni por la vista pública).
- [ ] Las cuatro transiciones de admin verifican `esAdmin()` antes de
  cualquier lectura/escritura con `createAdminClient()`.
- [ ] `costo_envio_propio`/`costo_envio_puni` tienen `check (>= 0)` — no
  se puede guardar un costo negativo por error de UI.
- [ ] Ningún dato de Puni (nombre, condiciones) se inventa en la UI de
  admin/vendedora — el costo lo carga el admin después de confirmar con
  Puni, nunca un valor de ejemplo hardcodeado.

## QA responsive

- [ ] `/viandera/perfil`: 375, 768, 1024, 1440px — formulario y sección de
  adhesión sin scroll horizontal, toggles ≥44px.
- [ ] `/admin`: nueva sección de solicitudes, mismos breakpoints.
- [ ] Insignia pública en `/explorar` y `/{slug}`: no rompe el layout de
  tarjeta existente en ningún breakpoint, no causa salto de layout (si el
  ícono tarda en cargar, reservar el espacio).

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** Al terminar las Tasks 1-7 en una rama local, detenerse
y reportar: qué se implementó, resultado de tests, cualquier desvío del
plan y por qué.
