# Panel de viandera — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un panel donde una viandera invitada edita su perfil y administra
su menú (altas, bajas, disponibilidad, fotos), reemplazando la carga manual
en el dashboard de Supabase. Incluye un panel mínimo de administración
(`/admin`) para invitar vianderas nuevas.

**Architecture:** Dos áreas nuevas gateadas por el middleware existente:
`/admin` (un solo admin, chequeado por email) y `/viandera` (chequeado por
una fila de `vianderas` vinculada vía `user_id`). Las escrituras
administrativas (crear viandera, invitar, vincular cuenta) corren con la
service role key del lado del servidor; las escrituras de la propia
viandera sobre su perfil/menú corren con RLS normal.

**Tech Stack:** Next.js 16 App Router + Server Actions, Supabase (Postgres,
Auth admin API, Storage), MapLibre GL JS (selector de ubicación con pin
arrastrable), Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-08-22-panel-viandera-design.md`

## Global Constraints

- Server Components por defecto; `'use client'` solo donde haga falta
  interactividad (mapas, formularios con `useActionState`).
- Componentes de mapa (MapLibre) se importan siempre con `next/dynamic` +
  `{ ssr: false }` desde un wrapper `'use client'` — nunca directo desde un
  Server Component (ver `components/map/ViandaMapLoader.tsx` como
  referencia exacta a seguir).
- Nunca envolver un `<form action={...}>` con `AnimatePresence` / usar
  `motion.form` — rompe el swap de estado post-submit (regla ya documentada
  en `CLAUDE.md`).
- Todos los textos de interfaz en español (es-AR).
- Paleta: `paper`/`ink`/`card`/`coral`/`teal` de `tailwind.config.ts`,
  tipografía `font-display` (títulos) / `font-sans` (texto), siguiendo el
  mismo patrón de `campoClase`/`BotonEnviar` que ya usan
  `FormularioLogin.tsx`, `FormularioRegistro.tsx` y `FormularioInteres.tsx`.
- **`SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_EMAIL` son server-only** — nunca
  con prefijo `NEXT_PUBLIC_`, nunca importados desde un archivo `'use
  client'`. El repo de GitHub es público: no hardcodear el email del admin
  literal en el código, siempre vía `process.env.ADMIN_EMAIL`.
- **Ningún task ejecuta SQL contra Supabase automáticamente.** El SQL de
  Tarea 1 se presenta al usuario para que lo corra él mismo en el SQL
  Editor de Supabase (mismo patrón que el schema original documentado en
  `CLAUDE.md`) — es un cambio de esquema en una base de datos de
  producción, requiere confirmación humana explícita, no autoejecución por
  un subagente.
- RLS es el límite real de seguridad para las escrituras de la propia
  viandera; los `.eq("vianderas_id", vianderaId)` explícitos en las Server
  Actions son defensa en profundidad, no el único control.
- No se toca `lib/supabase/middleware.ts` más allá de lo que este plan
  necesita — hay otra sesión de trabajo en paralelo corrigiendo hallazgos
  menores en ese mismo archivo (copia de cookies, matcher). Antes de
  arrancar la Tarea 3, confirmar que esa rama ya se mezcló o coordinar para
  evitar un conflicto de merge.

---

## Tarea 1: Migración de base de datos, storage y variables de entorno

**Files:**
- Modify: `CLAUDE.md` (sección de schema + variables de entorno)
- No se crean archivos de código en esta tarea — es SQL para correr a mano
  y documentación.

**Interfaces:**
- Produce: columna `vianderas.user_id`, políticas RLS nuevas, bucket de
  Storage `platos` — que las Tareas 2-7 asumen que ya existen.

- [ ] **Step 1: Preparar el SQL de la migración**

Este es el bloque completo que hay que correr en Supabase Dashboard → SQL
Editor (todo junto, es idempotente si se corre una sola vez):

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

- [ ] **Step 2: Pedirle al usuario que corra el SQL**

Presentar el bloque completo del Step 1 y pedir confirmación explícita de
que lo corrió en el SQL Editor de Supabase, antes de seguir. Si el
implementador de esta tarea es un subagente sin capacidad de esperar una
confirmación humana en vivo, debe DETENERSE acá y reportar `BLOCKED` con el
SQL listo, no continuar asumiendo que ya se corrió.

- [ ] **Step 3: Conseguir y cargar `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_EMAIL`**

Pedirle al usuario:
1. El valor de `service_role` desde Supabase Dashboard → Project Settings →
   API (es secreto, nunca pedirlo por un canal inseguro ni mostrarlo en
   texto plano innecesariamente — que lo pegue él mismo en `.env.local`).
2. El email que va a usar como cuenta de administrador (probablemente el
   mismo con el que ya loguea en el proyecto).

Agregar a `.env.local` (el usuario edita el archivo, no se commitea):

```
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
```

Recordarle que también hay que cargar ambas en Vercel → Settings →
Environment Variables → Production (y Preview si corresponde) antes de que
el panel de admin o el reclamo de cuenta funcionen en producción — el
mismo tipo de olvido que causó el 500 de middleware la vez pasada.

- [ ] **Step 4: Documentar en CLAUDE.md**

En la sección "Variables de entorno" de `CLAUDE.md`, agregar debajo del
bloque existente:

```
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
```

Con una nota: "Las dos son server-only — nunca `NEXT_PUBLIC_`. Se usan para
el panel de admin (`/admin`) y el panel de viandera (`/viandera`): invitar
cuentas, vincular la cuenta de una viandera a su fila en `vianderas`, y
verificar quién es el admin sin una tabla de roles."

En la sección "Schema de base de datos", agregar después del bloque SQL
existente el bloque completo del Step 1 de esta tarea, con una frase
introductoria: "Agregado para el panel de viandera (altas/ediciones desde
`/viandera`, invitaciones desde `/admin`):".

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document schema/env additions for the viandera panel (migration run manually in Supabase)"
```

---

## Tarea 2: Infraestructura — tipos, cliente admin, helper de storage

**Files:**
- Modify: `types/index.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/auth/admin.ts`
- Create: `lib/viandera/storage.ts`

**Interfaces:**
- Consumes: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` (Tarea 1).
- Produces: `createAdminClient(): SupabaseClient<Database>` (service role,
  sin sesión de usuario), `esAdmin(email): boolean`,
  `pathDesdeFotoUrl(fotoUrl: string): string | null`,
  `fotoUrlDesdePath(path: string): string`. Las Tareas 3-7 consumen estas
  cuatro funciones y el `Viandera.user_id` nuevo.

- [ ] **Step 1: Agregar `user_id` al tipo `Viandera`**

En `types/index.ts`, modificar el tipo `Viandera` (el resto del archivo
—`Vianda`, `InteresadoViandera`, `Database`— no cambia, ya deriva
automáticamente de este tipo):

```typescript
export type Viandera = {
  id: string;
  nombre: string;
  bio: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  activo: boolean;
  user_id: string | null;
  created_at: string;
};
```

- [ ] **Step 2: Cliente admin (service role)**

Crear `lib/supabase/admin.ts`:

```typescript
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

Nunca importar este archivo desde un componente `'use client'` ni desde
código que se ejecute en el browser — usa la service role key, que bypassa
RLS por completo.

- [ ] **Step 3: Chequeo de admin**

Crear `lib/auth/admin.ts`:

```typescript
export function esAdmin(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return Boolean(
    adminEmail && email && email.toLowerCase() === adminEmail.toLowerCase(),
  );
}
```

- [ ] **Step 4: Helpers de storage**

Crear `lib/viandera/storage.ts`:

```typescript
const PREFIJO_PUBLICO = "/storage/v1/object/public/platos/";

export function pathDesdeFotoUrl(fotoUrl: string): string | null {
  const index = fotoUrl.indexOf(PREFIJO_PUBLICO);
  if (index === -1) return null;
  return fotoUrl.slice(index + PREFIJO_PUBLICO.length);
}

export function fotoUrlDesdePath(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}${PREFIJO_PUBLICO}${path}`;
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/supabase/admin.ts lib/auth/admin.ts lib/viandera/storage.ts
git commit -m "Add admin client, admin email check, and storage path helpers for the viandera panel"
```

---

## Tarea 3: Middleware — gating y reclamo de cuenta para `/viandera` y `/admin`

**Files:**
- Modify: `lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `createAdminClient` y `esAdmin` (Tarea 2).
- Produces: `/admin` solo accesible por el email en `ADMIN_EMAIL`;
  `/viandera` solo accesible por una cuenta con una fila de `vianderas`
  vinculada (`user_id`) — y vincula automáticamente esa fila la primera vez
  que detecta un `vianderas_id` pendiente en el `user_metadata` de la
  sesión.

- [ ] **Step 1: Reemplazar `updateSession`**

Reemplazar el contenido completo de `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAdmin } from "@/lib/auth/admin";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaApp = pathname === "/app" || pathname.startsWith("/app/");
  const esRutaViandera =
    pathname === "/viandera" || pathname.startsWith("/viandera/");
  const esRutaAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!user && (esRutaApp || esRutaViandera || esRutaAdmin)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && esRutaAdmin && !esAdmin(user.email)) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  if (user && esRutaViandera) {
    const { data: vianderaPropia } = await supabase
      .from("vianderas")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vianderaPropia) {
      const vianderasIdPendiente = user.user_metadata?.vianderas_id as
        | string
        | undefined;
      let vinculada = false;

      if (vianderasIdPendiente) {
        const admin = createAdminClient();
        const { data: reclamada } = await admin
          .from("vianderas")
          .update({ user_id: user.id })
          .eq("id", vianderasIdPendiente)
          .is("user_id", null)
          .select("id")
          .maybeSingle();
        vinculada = Boolean(reclamada);
      }

      if (!vinculada) {
        return NextResponse.redirect(new URL("/app", request.url));
      }
    }
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: los tres terminan sin errores.

- [ ] **Step 3: Verificar en el navegador**

Con `npm run dev`:
1. Sin loguearse, visitar `/admin` → redirige a `/login?redirect=%2Fadmin`.
2. Sin loguearse, visitar `/viandera` → redirige a
   `/login?redirect=%2Fviandera`.
3. Logueado con una cuenta de consumidor normal (sin fila de `vianderas`),
   visitar `/viandera` → redirige a `/app`.
4. Logueado con una cuenta de consumidor normal, visitar `/admin` → redirige
   a `/app` (a menos que su email coincida con `ADMIN_EMAIL`, en cuyo caso
   entra).

El caso de una viandera invitada aceptando la invitación se verifica recién
en la Tarea 4 (todavía no existe forma de invitar a nadie).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "Gate /viandera and /admin, auto-claim viandera accounts on first login"
```

---

## Tarea 4: Panel de administración (`/admin`) — invitar vianderas

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/actions.ts`
- Create: `components/admin/FormularioInvitar.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (Tarea 2), gating de `/admin` (Tarea 3),
  `cerrarSesion` de `app/auth/actions.ts` (ya existe).
- Produces: `invitarViandera(prevState, formData): Promise<EstadoInvitacion>`
  — no lo consume ninguna tarea posterior, es autocontenido.

- [ ] **Step 1: Layout del área de admin**

Crear `app/admin/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { cerrarSesion } from "@/app/auth/actions";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex justify-end">
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="px-3 py-3 text-sm font-medium text-ink/60 transition-colors hover:text-coral"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Server Action de invitación**

Crear `app/admin/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoInvitacion =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function invitarViandera(
  _prevState: EstadoInvitacion,
  formData: FormData,
): Promise<EstadoInvitacion> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!nombre || !email) {
    return { status: "error", mensaje: "Completá el nombre y el email." };
  }

  const admin = createAdminClient();

  const { data: viandera, error: errorInsert } = await admin
    .from("vianderas")
    .insert({
      nombre,
      bio: null,
      lat: null,
      lng: null,
      telefono: null,
      activo: true,
      user_id: null,
    })
    .select("id")
    .single();

  if (errorInsert || !viandera) {
    return {
      status: "error",
      mensaje: "No pudimos crear la viandera. Probá de nuevo.",
    };
  }

  const { error: errorInvite } = await admin.auth.admin.inviteUserByEmail(
    email,
    { data: { vianderas_id: viandera.id } },
  );

  if (errorInvite) {
    await admin.from("vianderas").delete().eq("id", viandera.id);
    return {
      status: "error",
      mensaje:
        "No pudimos enviar la invitación (¿el email ya tiene una cuenta?).",
    };
  }

  revalidatePath("/admin");
  return { status: "ok" };
}
```

- [ ] **Step 3: Formulario de invitación**

Crear `components/admin/FormularioInvitar.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { invitarViandera, type EstadoInvitacion } from "@/app/admin/actions";

const campoClase =
  "rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

function BotonInvitar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Invitando..." : "Invitar"}
    </button>
  );
}

export default function FormularioInvitar() {
  const [estado, formAction] = useActionState<EstadoInvitacion, FormData>(
    invitarViandera,
    { status: "idle" },
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium text-ink/80">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            className={campoClase}
            placeholder="Doña Rosa"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink/80">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={campoClase}
            placeholder="viandera@ejemplo.com"
          />
        </div>
      </div>

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Invitación enviada.
        </p>
      )}

      <div>
        <BotonInvitar />
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Página de admin**

Crear `app/admin/page.tsx`:

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import FormularioInvitar from "@/components/admin/FormularioInvitar";

export default async function AdminPage() {
  const admin = createAdminClient();
  const { data: vianderas } = await admin
    .from("vianderas")
    .select("id, nombre, user_id, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">
        Invitar vianderas
      </h1>
      <p className="mt-2 text-ink/60">
        Creá la ficha y mandale la invitación por email.
      </p>

      <div className="mt-8">
        <FormularioInvitar />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">
          Vianderas
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {(vianderas ?? []).map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-ink/10 bg-card px-4 py-3"
            >
              <span className="text-sm font-medium text-ink">{v.nombre}</span>
              <span
                className={`text-xs font-medium ${
                  v.user_id ? "text-teal-700" : "text-ink/40"
                }`}
              >
                {v.user_id ? "Cuenta activa" : "Invitada, pendiente"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador**

Logueado con la cuenta cuyo email coincide con `ADMIN_EMAIL`:
1. Visitar `/admin` → entra, ve el formulario y la lista (vacía al
   principio).
2. Invitar una viandera de prueba con un email real al que tengas acceso →
   confirmar que aparece en la lista como "Invitada, pendiente" y que llega
   el mail de invitación de Supabase.
3. Aceptar la invitación (definir contraseña) y visitar `/viandera` →
   confirmar que entra (el reclamo automático de la Tarea 3 la vincula) y
   no rebota a `/app`. El contenido de `/viandera` en sí todavía es solo lo
   que exista de las tareas anteriores — puede dar 404 hasta la Tarea 5,
   eso es esperado.

- [ ] **Step 7: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx app/admin/actions.ts components/admin/FormularioInvitar.tsx
git commit -m "Add admin panel to invite vianderas"
```

---

## Tarea 5: Dashboard de la viandera — layout, resumen y platos

**Files:**
- Create: `app/viandera/layout.tsx`
- Create: `app/viandera/page.tsx`
- Create: `app/viandera/actions.ts`
- Create: `components/viandera/TarjetaPlato.tsx`

**Interfaces:**
- Consumes: gating de `/viandera` (Tarea 3), `cerrarSesion` (ya existe).
- Produces: `obtenerVianderaId` (helper interno, no exportado, en
  `app/viandera/actions.ts` — las Tareas 6 y 7 lo reusan agregando código
  al mismo archivo), `alternarDisponibilidad(formData): Promise<void>`,
  `borrarPlato(formData): Promise<void>`.

- [ ] **Step 1: Layout del panel de viandera**

Crear `app/viandera/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { cerrarSesion } from "@/app/auth/actions";

export default function VianderaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/viandera/perfil"
          className="px-3 py-3 text-sm font-medium text-ink/60 transition-colors hover:text-coral"
        >
          Editar perfil
        </Link>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="px-3 py-3 text-sm font-medium text-ink/60 transition-colors hover:text-coral"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Server Actions del panel**

Crear `app/viandera/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { pathDesdeFotoUrl } from "@/lib/viandera/storage";
import type { Database } from "@/types";

async function obtenerVianderaId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("vianderas")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
}

export async function alternarDisponibilidad(formData: FormData): Promise<void> {
  const viandaId = String(formData.get("viandaId") ?? "");
  const disponibleActual = formData.get("disponible") === "true";

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) redirect("/app");

  await supabase
    .from("viandas")
    .update({ disponible: !disponibleActual })
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId);

  revalidatePath("/viandera");
}

export async function borrarPlato(formData: FormData): Promise<void> {
  const viandaId = String(formData.get("viandaId") ?? "");

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) redirect("/app");

  const { data: plato } = await supabase
    .from("viandas")
    .select("foto_url")
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId)
    .maybeSingle();

  await supabase
    .from("viandas")
    .delete()
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId);

  if (plato?.foto_url) {
    const path = pathDesdeFotoUrl(plato.foto_url);
    if (path) await supabase.storage.from("platos").remove([path]);
  }

  revalidatePath("/viandera");
}
```

- [ ] **Step 3: Tarjeta de plato**

Crear `components/viandera/TarjetaPlato.tsx`:

```tsx
"use client";

import Link from "next/link";
import { alternarDisponibilidad, borrarPlato } from "@/app/viandera/actions";
import type { TipoVianda } from "@/types";

type Plato = {
  id: string;
  nombre: string;
  precio: number | null;
  tipo: TipoVianda;
  foto_url: string | null;
  disponible: boolean;
};

export default function TarjetaPlato({ plato }: { plato: Plato }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-ink/10 bg-card p-4 shadow-sm">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-paper">
        {plato.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={plato.foto_url}
            alt={plato.nombre}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="font-display text-base font-semibold text-ink">
          {plato.nombre}
        </p>
        <p className="text-xs uppercase tracking-wide text-ink/40">
          {plato.tipo}
        </p>
        {plato.precio != null && (
          <p className="text-sm font-medium text-coral">
            ${plato.precio.toLocaleString("es-AR")}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <form action={alternarDisponibilidad}>
            <input type="hidden" name="viandaId" value={plato.id} />
            <input
              type="hidden"
              name="disponible"
              value={String(plato.disponible)}
            />
            <button
              type="submit"
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                plato.disponible
                  ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                  : "bg-ink/10 text-ink/50 hover:bg-ink/15"
              }`}
            >
              {plato.disponible ? "Disponible" : "No disponible"}
            </button>
          </form>

          <Link
            href={`/viandera/platos/${plato.id}/editar`}
            className="px-1 py-3 text-xs font-medium text-ink/60 hover:text-coral"
          >
            Editar
          </Link>

          <form
            action={borrarPlato}
            onSubmit={(e) => {
              if (!window.confirm(`¿Borrar "${plato.nombre}"?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="viandaId" value={plato.id} />
            <button
              type="submit"
              className="px-1 py-3 text-xs font-medium text-ink/60 hover:text-coral"
            >
              Borrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Página del dashboard**

Crear `app/viandera/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TarjetaPlato from "@/components/viandera/TarjetaPlato";

export default async function VianderaDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id, nombre, activo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viandera) redirect("/app");

  const { data: platos } = await supabase
    .from("viandas")
    .select("id, nombre, precio, tipo, foto_url, disponible")
    .eq("vianderas_id", viandera.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-ink">
          {viandera.nombre}
        </h1>
        <p className="text-sm text-ink/60">
          {viandera.activo ? "Perfil activo" : "Perfil inactivo"}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">
          Tus platos
        </h2>
        <Link
          href="/viandera/platos/nuevo"
          className="rounded-full bg-coral px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-coral-600 hover:shadow-md active:scale-95"
        >
          + Agregar plato
        </Link>
      </div>

      {(platos ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          Todavía no cargaste ningún plato.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(platos ?? []).map((plato) => (
            <TarjetaPlato key={plato.id} plato={plato} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador**

Con la cuenta de viandera de prueba de la Tarea 4:
1. Visitar `/viandera` → ve su nombre, "Perfil activo", "Todavía no
   cargaste ningún plato.", botón "+ Agregar plato" (el link a
   `/viandera/platos/nuevo` puede dar 404 todavía, eso es esperado hasta la
   Tarea 7).
2. Insertar manualmente un par de platos de prueba en la tabla `viandas`
   desde Supabase (con el `vianderas_id` correcto) para verificar que la
   grilla, el toggle de disponibilidad y el borrado funcionan de punta a
   punta.
3. Confirmar que una cuenta de consumidor normal (sin viandera vinculada)
   sigue sin poder entrar a `/viandera` (ya cubierto en la Tarea 3, pero
   reverificar con contenido real en la página).

- [ ] **Step 7: Commit**

```bash
git add app/viandera/layout.tsx app/viandera/page.tsx app/viandera/actions.ts components/viandera/TarjetaPlato.tsx
git commit -m "Add viandera dashboard: profile summary and dish list with availability toggle"
```

---

## Tarea 6: Editar perfil — formulario y selector de ubicación en el mapa

**Files:**
- Create: `components/map/SelectorUbicacion.tsx`
- Create: `components/map/SelectorUbicacionLoader.tsx`
- Create: `components/viandera/FormularioPerfil.tsx`
- Create: `app/viandera/perfil/page.tsx`
- Modify: `app/viandera/actions.ts` (agregar `actualizarPerfil`)

**Interfaces:**
- Consumes: `obtenerVianderaId` (helper interno ya definido en
  `app/viandera/actions.ts`, Tarea 5).
- Produces: `actualizarPerfil(prevState, formData): Promise<EstadoPerfil>`.

- [ ] **Step 1: Selector de ubicación (mapa con pin arrastrable)**

Crear `components/map/SelectorUbicacion.tsx` — mismo patrón de
`ViandaMap.tsx` (raster tiles, worker servido como asset estático, ver el
comentario de ese archivo para el motivo), agregando un `Marker`
arrastrable:

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  Map,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const RAFAELA_CENTER: [number, number] = [-61.4882, -31.2527];

setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

export default function SelectorUbicacion({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const centro: [number, number] =
      lat != null && lng != null ? [lng, lat] : RAFAELA_CENTER;

    mapRef.current = new Map({
      container: containerRef.current,
      style: STYLE,
      center: centro,
      zoom: 14,
    });

    mapRef.current.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right",
    );

    const marker = new Marker({ draggable: true, color: "#D85A30" })
      .setLngLat(centro)
      .addTo(mapRef.current);

    marker.on("dragend", () => {
      const posicion = marker.getLngLat();
      onChangeRef.current(posicion.lat, posicion.lng);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[40vh] min-h-[280px] w-full overflow-hidden rounded-2xl"
    />
  );
}
```

- [ ] **Step 2: Wrapper con `next/dynamic`**

Crear `components/map/SelectorUbicacionLoader.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

const SelectorUbicacion = dynamic(() => import("./SelectorUbicacion"), {
  ssr: false,
});

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

export default function SelectorUbicacionLoader(props: Props) {
  return <SelectorUbicacion {...props} />;
}
```

- [ ] **Step 3: Server Action de perfil**

Agregar al final de `app/viandera/actions.ts` (no reescribir el archivo,
sumar esto — necesita `revalidatePath` que ya está importado):

```typescript
export type EstadoPerfil =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function actualizarPerfil(
  _prevState: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const latRaw = String(formData.get("lat") ?? "");
  const lngRaw = String(formData.get("lng") ?? "");

  if (!nombre) {
    return { status: "error", mensaje: "El nombre no puede estar vacío." };
  }

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) {
    return { status: "error", mensaje: "No pudimos identificar tu perfil." };
  }

  const { error } = await supabase
    .from("vianderas")
    .update({
      nombre,
      bio: bio || null,
      telefono: telefono || null,
      lat: latRaw ? Number(latRaw) : null,
      lng: lngRaw ? Number(lngRaw) : null,
    })
    .eq("id", vianderaId);

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar los cambios. Probá de nuevo.",
    };
  }

  revalidatePath("/viandera/perfil");
  return { status: "ok" };
}
```

- [ ] **Step 4: Formulario de perfil**

Crear `components/viandera/FormularioPerfil.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import SelectorUbicacionLoader from "@/components/map/SelectorUbicacionLoader";
import { actualizarPerfil, type EstadoPerfil } from "@/app/viandera/actions";

const campoClase =
  "rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

function BotonGuardar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}

type Props = {
  nombreInicial: string;
  bioInicial: string;
  telefonoInicial: string;
  latInicial: number | null;
  lngInicial: number | null;
};

export default function FormularioPerfil({
  nombreInicial,
  bioInicial,
  telefonoInicial,
  latInicial,
  lngInicial,
}: Props) {
  const [estado, formAction] = useActionState<EstadoPerfil, FormData>(
    actualizarPerfil,
    { status: "idle" },
  );
  const [ubicacion, setUbicacion] = useState({
    lat: latInicial,
    lng: lngInicial,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lat" value={ubicacion.lat ?? ""} />
      <input type="hidden" name="lng" value={ubicacion.lng ?? ""} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre" className="text-sm font-medium text-ink/80">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={nombreInicial}
          className={campoClase}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium text-ink/80">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={bioInicial}
          className={`${campoClase} resize-none`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="telefono" className="text-sm font-medium text-ink/80">
          Teléfono / WhatsApp
        </label>
        <input
          id="telefono"
          name="telefono"
          type="text"
          inputMode="tel"
          defaultValue={telefonoInicial}
          className={campoClase}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink/80">
          Ubicación (arrastrá el pin)
        </span>
        <SelectorUbicacionLoader
          lat={ubicacion.lat}
          lng={ubicacion.lng}
          onChange={(lat, lng) => setUbicacion({ lat, lng })}
        />
      </div>

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Perfil actualizado.
        </p>
      )}

      <div>
        <BotonGuardar />
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Página de edición de perfil**

Crear `app/viandera/perfil/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioPerfil from "@/components/viandera/FormularioPerfil";

export default async function PerfilVianderaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("nombre, bio, telefono, lat, lng")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viandera) redirect("/app");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-ink">Tu perfil</h1>
      <p className="mt-2 text-ink/60">Así te van a encontrar tus vecinos.</p>
      <div className="mt-8 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
        <FormularioPerfil
          nombreInicial={viandera.nombre}
          bioInicial={viandera.bio ?? ""}
          telefonoInicial={viandera.telefono ?? ""}
          latInicial={viandera.lat}
          lngInicial={viandera.lng}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: sin errores.

- [ ] **Step 7: Verificar en el navegador**

Con la cuenta de viandera de prueba:
1. Visitar `/viandera/perfil` → ve el formulario precargado con sus datos
   actuales (vacíos la primera vez) y el mapa centrado en Rafaela con un
   pin.
2. Arrastrar el pin, guardar → confirmar en Supabase que `lat`/`lng` se
   actualizaron en la fila correcta.
3. Cambiar nombre/bio/teléfono, guardar → confirmar que persiste y que
   `/viandera` (el dashboard) refleja el nombre nuevo.

- [ ] **Step 8: Commit**

```bash
git add components/map/SelectorUbicacion.tsx components/map/SelectorUbicacionLoader.tsx components/viandera/FormularioPerfil.tsx app/viandera/perfil/page.tsx app/viandera/actions.ts
git commit -m "Add viandera profile editing with a draggable-pin location picker"
```

---

## Tarea 7: Alta y edición de platos con foto

**Files:**
- Create: `components/viandera/FormularioPlato.tsx`
- Create: `app/viandera/platos/nuevo/page.tsx`
- Create: `app/viandera/platos/[id]/editar/page.tsx`
- Modify: `app/viandera/actions.ts` (agregar `crearPlato`, `actualizarPlato`)
- Modify: `CLAUDE.md` ("Estado del proyecto")

**Interfaces:**
- Consumes: `obtenerVianderaId` (Tarea 5), `pathDesdeFotoUrl` /
  `fotoUrlDesdePath` (Tarea 2).
- Produces: `crearPlato`, `actualizarPlato` — no los consume ninguna tarea
  posterior, cierra el alcance de la v1 del panel.

- [ ] **Step 1: Server Actions de alta/edición de platos**

Agregar al final de `app/viandera/actions.ts`. Necesita un import nuevo al
principio del archivo — sumarlo al bloque de imports existente:

```typescript
import { fotoUrlDesdePath } from "@/lib/viandera/storage";
import type { TipoVianda } from "@/types";
```

(`pathDesdeFotoUrl` ya está importado desde la Tarea 5; agregar
`fotoUrlDesdePath` al mismo import en vez de duplicar la línea.)

Y el código:

```typescript
export type EstadoPlato =
  | { status: "idle" }
  | { status: "error"; mensaje: string };

async function subirFoto(
  supabase: SupabaseClient<Database>,
  vianderaId: string,
  foto: File,
): Promise<string | null> {
  const extension = foto.name.split(".").pop() || "jpg";
  const path = `${vianderaId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from("platos")
    .upload(path, foto, { contentType: foto.type, upsert: false });

  if (error) return null;
  return fotoUrlDesdePath(path);
}

export async function crearPlato(
  _prevState: EstadoPlato,
  formData: FormData,
): Promise<EstadoPlato> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const precioRaw = String(formData.get("precio") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoVianda;
  const foto = formData.get("foto");

  if (!nombre || !tipo) {
    return { status: "error", mensaje: "Completá el nombre y el tipo." };
  }

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) {
    return { status: "error", mensaje: "No pudimos identificar tu perfil." };
  }

  let fotoUrl: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    fotoUrl = await subirFoto(supabase, vianderaId, foto);
  }

  const { error } = await supabase.from("viandas").insert({
    vianderas_id: vianderaId,
    nombre,
    descripcion: descripcion || null,
    precio: precioRaw ? Number(precioRaw) : null,
    tipo,
    foto_url: fotoUrl,
    disponible: true,
  });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar el plato. Probá de nuevo.",
    };
  }

  revalidatePath("/viandera");
  redirect("/viandera");
}

export async function actualizarPlato(
  _prevState: EstadoPlato,
  formData: FormData,
): Promise<EstadoPlato> {
  const platoId = String(formData.get("platoId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const precioRaw = String(formData.get("precio") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoVianda;
  const disponible = formData.get("disponible") === "on";
  const fotoUrlActual = String(formData.get("fotoUrlActual") ?? "") || null;
  const foto = formData.get("foto");

  if (!platoId || !nombre || !tipo) {
    return { status: "error", mensaje: "Completá el nombre y el tipo." };
  }

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) {
    return { status: "error", mensaje: "No pudimos identificar tu perfil." };
  }

  let fotoUrl = fotoUrlActual;
  if (foto instanceof File && foto.size > 0) {
    const nuevaUrl = await subirFoto(supabase, vianderaId, foto);
    if (nuevaUrl) {
      if (fotoUrlActual) {
        const pathAnterior = pathDesdeFotoUrl(fotoUrlActual);
        if (pathAnterior) {
          await supabase.storage.from("platos").remove([pathAnterior]);
        }
      }
      fotoUrl = nuevaUrl;
    }
  }

  const { error } = await supabase
    .from("viandas")
    .update({
      nombre,
      descripcion: descripcion || null,
      precio: precioRaw ? Number(precioRaw) : null,
      tipo,
      disponible,
      foto_url: fotoUrl,
    })
    .eq("id", platoId)
    .eq("vianderas_id", vianderaId);

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar los cambios. Probá de nuevo.",
    };
  }

  revalidatePath("/viandera");
  redirect("/viandera");
}
```

- [ ] **Step 2: Formulario de plato (compartido entre alta y edición)**

Crear `components/viandera/FormularioPlato.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { crearPlato, actualizarPlato, type EstadoPlato } from "@/app/viandera/actions";
import type { TipoVianda } from "@/types";

const campoClase =
  "rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

function BotonGuardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Guardando..." : texto}
    </button>
  );
}

type Props = {
  modo: "nuevo" | "editar";
  platoId?: string;
  valoresIniciales?: {
    nombre: string;
    descripcion: string;
    precio: string;
    tipo: TipoVianda;
    fotoUrl: string | null;
    disponible: boolean;
  };
};

export default function FormularioPlato({
  modo,
  platoId,
  valoresIniciales,
}: Props) {
  const accion = modo === "nuevo" ? crearPlato : actualizarPlato;
  const [estado, formAction] = useActionState<EstadoPlato, FormData>(accion, {
    status: "idle",
  });

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="flex flex-col gap-4"
    >
      {modo === "editar" && platoId && (
        <input type="hidden" name="platoId" value={platoId} />
      )}
      {valoresIniciales?.fotoUrl && (
        <input
          type="hidden"
          name="fotoUrlActual"
          value={valoresIniciales.fotoUrl}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre" className="text-sm font-medium text-ink/80">
          Nombre del plato
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={valoresIniciales?.nombre}
          className={campoClase}
          placeholder="Ej: Milanesa con puré"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="descripcion"
          className="text-sm font-medium text-ink/80"
        >
          Descripción <span className="text-ink/40">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          defaultValue={valoresIniciales?.descripcion}
          className={`${campoClase} resize-none`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="precio" className="text-sm font-medium text-ink/80">
            Precio <span className="text-ink/40">(opcional)</span>
          </label>
          <input
            id="precio"
            name="precio"
            type="number"
            min="0"
            step="1"
            defaultValue={valoresIniciales?.precio}
            className={campoClase}
            placeholder="4200"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo" className="text-sm font-medium text-ink/80">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue={valoresIniciales?.tipo ?? ""}
            className={campoClase}
          >
            <option value="" disabled>
              Elegí una opción
            </option>
            <option value="almuerzo">Almuerzo</option>
            <option value="cena">Cena</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="foto" className="text-sm font-medium text-ink/80">
          Foto{" "}
          {valoresIniciales?.fotoUrl && (
            <span className="text-ink/40">
              (dejá vacío para mantener la actual)
            </span>
          )}
        </label>
        <input
          id="foto"
          name="foto"
          type="file"
          accept="image/*"
          className={campoClase}
        />
      </div>

      {modo === "editar" && (
        <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
          <input
            type="checkbox"
            name="disponible"
            defaultChecked={valoresIniciales?.disponible}
            className="h-4 w-4 rounded border-ink/25 text-coral focus:ring-coral/25"
          />
          Disponible
        </label>
      )}

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}

      <div>
        <BotonGuardar texto={modo === "nuevo" ? "Agregar plato" : "Guardar cambios"} />
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Página de alta**

Crear `app/viandera/platos/nuevo/page.tsx`:

```tsx
import FormularioPlato from "@/components/viandera/FormularioPlato";

export default function NuevoPlatoPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-ink">
        Nuevo plato
      </h1>
      <div className="mt-8 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
        <FormularioPlato modo="nuevo" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Página de edición**

Crear `app/viandera/platos/[id]/editar/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioPlato from "@/components/viandera/FormularioPlato";

export default async function EditarPlatoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plato } = await supabase
    .from("viandas")
    .select("id, nombre, descripcion, precio, tipo, foto_url, disponible")
    .eq("id", id)
    .maybeSingle();

  if (!plato) redirect("/viandera");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-ink">
        Editar plato
      </h1>
      <div className="mt-8 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
        <FormularioPlato
          modo="editar"
          platoId={plato.id}
          valoresIniciales={{
            nombre: plato.nombre,
            descripcion: plato.descripcion ?? "",
            precio: plato.precio?.toString() ?? "",
            tipo: plato.tipo,
            fotoUrl: plato.foto_url,
            disponible: plato.disponible,
          }}
        />
      </div>
    </div>
  );
}
```

(La RLS de la Tarea 1 ya impide que esta consulta devuelva un plato ajeno —
si `id` pertenece a otra viandera, `select` no lo trae y `redirect("/viandera")`
corre igual que si no existiera.)

- [ ] **Step 5: Actualizar "Estado del proyecto" en CLAUDE.md**

Agregar un párrafo nuevo al final de la sección "Estado del proyecto":

"Panel de viandera (agregado 2026-08-22): las vianderas invitadas desde
`/admin` ya no se cargan a mano en el dashboard de Supabase — entran a
`/viandera` con su propia cuenta, editan su perfil (incluida la ubicación
con un pin arrastrable en el mapa) y administran su menú completo, con
fotos reales en Supabase Storage. `/admin` es un panel de un solo admin
(chequeado por `ADMIN_EMAIL`), no un sistema de roles."

- [ ] **Step 6: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: sin errores.

- [ ] **Step 7: Verificar en el navegador**

Con la cuenta de viandera de prueba:
1. `/viandera/platos/nuevo` → cargar un plato completo con foto real →
   confirmar que redirige a `/viandera` y el plato aparece en la grilla con
   la foto.
2. Editar ese plato desde `/viandera/platos/[id]/editar`, cambiar el precio
   y subir una foto nueva → confirmar que se reemplaza (la vieja se borra
   del bucket, no queda huérfana) y los cambios persisten.
3. Editar un plato sin tocar el campo de foto → confirmar que la foto
   original se mantiene (no se pierde).
4. Borrar un plato desde la grilla (Tarea 5) → confirmar que también se
   borra su foto del bucket, no solo la fila.
5. Con una segunda cuenta de viandera de prueba (o manipulando la URL a un
   `id` de un plato ajeno), confirmar que `/viandera/platos/[id]/editar`
   redirige a `/viandera` en vez de mostrar datos de otra viandera.

- [ ] **Step 8: Commit**

```bash
git add components/viandera/FormularioPlato.tsx app/viandera/platos app/viandera/actions.ts CLAUDE.md
git commit -m "Add dish creation and editing with real photo uploads to Supabase Storage"
```

---

## Self-Review Notes

- **Cobertura de la spec:** las 6 secciones (A-F) del diseño aprobado
  tienen tarea — A→Tarea 1/2/3, B→Tarea 4, C→Tarea 3, D→Tareas 5/6/7,
  E→Tarea 7, F es una lista negativa, no requiere tarea.
- **Placeholders:** ninguno — cada Server Action, componente y policy SQL
  está completo, sin "TODO" ni "similar a la Tarea N" sin repetir el código.
- **Consistencia de tipos:** `EstadoInvitacion`, `EstadoPerfil`,
  `EstadoPlato` siguen el mismo patrón de unión discriminada que
  `EstadoAuth` (`app/auth/actions.ts`) — `idle` / `error` / (`ok` donde
  aplica). `obtenerVianderaId` se define una sola vez (Tarea 5) y las
  Tareas 6-7 lo reusan agregando código al mismo archivo, sin redefinirlo.
- **Decisión explícita fuera de la spec original:** la spec decía "email
  del admin hardcodeado en el código" — el plan usa `process.env.ADMIN_EMAIL`
  en su lugar, porque el repo de GitHub es público y hardcodear un email
  personal en una fuente pública sería una filtración de datos evitable sin
  costo extra. Mismo efecto (un admin, sin tabla de roles), mejor
  implementación.
- **Riesgo de conflicto de merge:** ver Global Constraints — otra rama en
  curso toca `lib/supabase/middleware.ts`. Antes de dispatchear la Tarea 3,
  confirmar el estado de esa rama.
