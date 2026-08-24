# Vidriera pública de la viandera — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página pública por viandera (`viandapp.ar/{slug}`) que muestra
su perfil y su menú real, con tags dietarios por plato — reemplazando el
mockup estático "Doña Rosa" por algo funcional.

**Architecture:** Dos columnas nuevas (`vianderas.slug`, `viandas.etiquetas`)
sobre el schema existente. El slug se genera automáticamente (del nombre)
al invitar o al guardar el perfil por primera vez, y es editable después.
Una ruta nueva a nivel raíz (`app/[slug]/page.tsx`), pública, sin auth,
reutiliza visualmente el componente `PreviewPerfil.tsx` que ya existe como
mockup en la landing, ahora con datos reales de Supabase.

**Tech Stack:** Next.js 16 App Router (Server Components), Supabase
(Postgres, RLS ya existente), Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-08-24-vidriera-publica-design.md`

## Global Constraints

- Server Components por defecto; `'use client'` solo donde haga falta
  interactividad (los formularios existentes ya lo hacen).
- Todos los textos de interfaz en español (es-AR).
- Paleta: `paper`/`ink`/`card`/`coral`/`teal` de `tailwind.config.ts`,
  reusar `campoClase` (`@/components/ui/campoClase`) y `BotonEnviar`
  (`@/components/ui/BotonEnviar`) en cualquier formulario nuevo — nunca
  duplicarlos localmente (ver el historial del proyecto: esto ya causó un
  hallazgo Important en una revisión anterior).
- **Ningún task ejecuta SQL contra Supabase automáticamente.** El SQL de
  la Tarea 1 se presenta al usuario para que lo corra él mismo en el SQL
  Editor de Supabase — requiere confirmación humana explícita.
- RLS es el límite real de seguridad para lecturas/escrituras de la propia
  viandera; los `.eq(...)` explícitos en las Server Actions son defensa en
  profundidad, no el único control (patrón ya establecido en el proyecto).
- La lista de palabras reservadas para slugs (`admin`, `app`, `auth`,
  `login`, `registro`, `viandera`, `api`) vive en un solo lugar
  (`lib/viandera/slug.ts`) — si se agrega una ruta nueva a nivel raíz en
  el futuro, sumarla ahí.

---

## Task 1: Migración de base de datos

**Files:**
- No se crean archivos de código — es SQL para correr a mano y
  documentación en `CLAUDE.md`.

**Interfaces:**
- Produce: columnas `vianderas.slug` (text, unique, nullable) y
  `viandas.etiquetas` (text[], not null default '{}') — que las Tareas
  2-5 asumen que ya existen.

- [ ] **Step 1: Preparar el SQL**

```sql
alter table vianderas
  add column slug text unique;

alter table viandas
  add column etiquetas text[] not null default '{}';
```

- [ ] **Step 2: Pedirle al usuario que corra el SQL**

Presentar el bloque completo y pedir confirmación explícita de que lo
corrió en el SQL Editor de Supabase antes de seguir. Si el implementador
de esta tarea es un subagente sin capacidad de esperar una confirmación
humana en vivo, debe DETENERSE acá y reportar `BLOCKED` con el SQL listo,
no continuar asumiendo que ya se corrió.

- [ ] **Step 3: Documentar en CLAUDE.md**

En la sección "Schema de base de datos", agregar después del bloque SQL
del panel de viandera (el que ya existe ahí) el bloque completo del
Step 1 de esta tarea, con una frase introductoria: "Agregado para la
vidriera pública de la viandera (`/{slug}`):".

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document schema additions for the public viandera storefront (migration run manually in Supabase)"
```

---

## Task 2: Infraestructura — slug, etiquetas, tipos

**Files:**
- Create: `lib/viandera/slug.ts`
- Create: `lib/viandera/etiquetas.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Produce: `normalizarSlug(valor: string): string`,
  `esSlugReservado(slug: string): boolean`,
  `generarSlugDisponible(supabase, nombreODeseado, vianderaIdAExcluir?): Promise<string>`,
  `ETIQUETAS_DIETARIAS` (lista de `{ valor, etiqueta }`),
  `EtiquetaDietaria` (tipo). Las Tareas 3-5 consumen todo esto.

- [ ] **Step 1: Helpers de slug**

Crear `lib/viandera/slug.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const RUTAS_RESERVADAS = new Set([
  "admin",
  "app",
  "auth",
  "login",
  "registro",
  "viandera",
  "api",
]);

export function normalizarSlug(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function esSlugReservado(slug: string): boolean {
  return RUTAS_RESERVADAS.has(slug);
}

export async function generarSlugDisponible(
  supabase: SupabaseClient<Database>,
  nombreODeseado: string,
  vianderaIdAExcluir?: string,
): Promise<string> {
  const base = normalizarSlug(nombreODeseado) || "viandera";
  let candidato = base;
  let sufijo = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!esSlugReservado(candidato)) {
      let query = supabase.from("vianderas").select("id").eq("slug", candidato);
      if (vianderaIdAExcluir) {
        query = query.neq("id", vianderaIdAExcluir);
      }
      const { data } = await query.maybeSingle();
      if (!data) return candidato;
    }
    candidato = `${base}-${sufijo}`;
    sufijo += 1;
  }
}
```

- [ ] **Step 2: Lista de etiquetas dietarias**

Crear `lib/viandera/etiquetas.ts`:

```typescript
export const ETIQUETAS_DIETARIAS = [
  { valor: "vegetariano", etiqueta: "Vegetariano" },
  { valor: "vegano", etiqueta: "Vegano" },
  { valor: "sin-tacc", etiqueta: "Sin TACC" },
  { valor: "apto-diabetico", etiqueta: "Apto diabético" },
  { valor: "sin-lactosa", etiqueta: "Sin lactosa" },
  { valor: "picante", etiqueta: "Picante" },
  { valor: "sin-azucar", etiqueta: "Sin azúcar" },
] as const;

export type EtiquetaDietaria = (typeof ETIQUETAS_DIETARIAS)[number]["valor"];
```

- [ ] **Step 3: Actualizar tipos**

En `types/index.ts`, modificar los tipos `Viandera` y `Vianda` (el resto
del archivo no cambia, deriva automáticamente):

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
  slug: string | null;
  created_at: string;
};

export type Vianda = {
  id: string;
  vianderas_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  tipo: TipoVianda;
  foto_url: string | null;
  disponible: boolean;
  etiquetas: string[];
  created_at: string;
};
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/viandera/slug.ts lib/viandera/etiquetas.ts types/index.ts
git commit -m "Add slug generation helpers and the dietary tags list"
```

---

## Task 3: Slug en la invitación y el perfil

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `app/viandera/actions.ts`
- Modify: `components/viandera/FormularioPerfil.tsx`
- Modify: `app/viandera/perfil/page.tsx`

**Interfaces:**
- Consumes: `generarSlugDisponible`, `normalizarSlug`, `esSlugReservado`
  (Tarea 2).
- Produces: toda `vianderas` nueva o guardada por primera vez tiene un
  `slug` válido — la Tarea 5 (página pública) asume que puede buscar por
  `slug` y encontrar filas reales.

- [ ] **Step 1: Generar slug al invitar**

En `app/admin/actions.ts`, agregar el import:

```typescript
import { generarSlugDisponible } from "@/lib/viandera/slug";
```

Y modificar `invitarViandera`: antes del `admin.from("vianderas").insert(...)`,
generar el slug y agregarlo al payload del insert. El bloque completo
queda así (reemplaza desde `const admin = createAdminClient();` hasta el
cierre del `.insert(...)`):

```typescript
  const admin = createAdminClient();
  const slug = await generarSlugDisponible(admin, nombre);

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
      slug,
    })
    .select("id")
    .single();
```

(El resto de la función —invite, rollback, link— no cambia.)

- [ ] **Step 2: Slug en `actualizarPerfil`**

En `app/viandera/actions.ts`, agregar el import:

```typescript
import { generarSlugDisponible, normalizarSlug, esSlugReservado } from "@/lib/viandera/slug";
```

Y reemplazar la función `actualizarPerfil` completa:

```typescript
export async function actualizarPerfil(
  _prevState: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const slugDeseado = String(formData.get("slug") ?? "").trim();
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

  let slug: string;
  if (slugDeseado) {
    const normalizado = normalizarSlug(slugDeseado);
    if (!normalizado || esSlugReservado(normalizado)) {
      return {
        status: "error",
        mensaje: "Esa dirección no está disponible. Probá con otra.",
      };
    }
    const { data: existente } = await supabase
      .from("vianderas")
      .select("id")
      .eq("slug", normalizado)
      .neq("id", vianderaId)
      .maybeSingle();
    if (existente) {
      return {
        status: "error",
        mensaje: "Esa dirección ya la está usando otra viandera.",
      };
    }
    slug = normalizado;
  } else {
    slug = await generarSlugDisponible(supabase, nombre, vianderaId);
  }

  const { error } = await supabase
    .from("vianderas")
    .update({
      nombre,
      bio: bio || null,
      telefono: telefono || null,
      slug,
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

(Dejar el campo del formulario vacío en el guardado siguiente
regeneraría el slug desde el nombre — pero como el formulario precarga el
slug actual como valor por defecto (Step 3), esto solo pasa en el primer
guardado, cuando todavía no hay slug.)

- [ ] **Step 3: Campo de slug en el formulario**

En `components/viandera/FormularioPerfil.tsx`:

Agregar `slugInicial: string` al tipo `Props` (después de `nombreInicial`).

Agregar el parámetro a la desestructuración de props.

Agregar este bloque nuevo, entre el campo de "Teléfono / WhatsApp" y el de
"Ubicación":

```tsx
      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-ink/80">
          Dirección de tu página
        </label>
        <div className="flex items-center gap-1 rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink/40 transition-colors focus-within:border-coral focus-within:ring-2 focus-within:ring-coral/25">
          <span>viandapp.ar/</span>
          <input
            id="slug"
            name="slug"
            type="text"
            defaultValue={slugInicial}
            placeholder="se genera solo si lo dejás vacío"
            className="flex-1 bg-transparent text-ink outline-none placeholder:text-ink/35"
          />
        </div>
      </div>
```

- [ ] **Step 4: Pasar el slug desde la página**

En `app/viandera/perfil/page.tsx`, agregar `slug` al `.select(...)`
(queda `"nombre, bio, telefono, lat, lng, slug"`) y pasar
`slugInicial={viandera.slug ?? ""}` como prop de `<FormularioPerfil>`.

- [ ] **Step 5: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador**

Con una cuenta de viandera de prueba:
1. Guardar el perfil por primera vez (sin tocar el campo de dirección) →
   confirmar en Supabase que `vianderas.slug` quedó generado del nombre.
2. Volver a `/viandera/perfil` → confirmar que el campo ahora muestra ese
   slug precargado.
3. Cambiarlo a mano por otro valor y guardar → confirmar que persiste el
   nuevo valor.
4. Intentar poner `admin` como dirección → confirmar que da el error
   "Esa dirección no está disponible."
5. Con una segunda cuenta de viandera de prueba, intentar poner el mismo
   slug que la primera → confirmar el error "Esa dirección ya la está
   usando otra viandera."

- [ ] **Step 7: Commit**

```bash
git add app/admin/actions.ts app/viandera/actions.ts components/viandera/FormularioPerfil.tsx app/viandera/perfil/page.tsx
git commit -m "Generate and let vianderas edit their public page slug"
```

---

## Task 4: Tags dietarios en los platos

**Files:**
- Modify: `app/viandera/actions.ts`
- Modify: `components/viandera/FormularioPlato.tsx`
- Modify: `app/viandera/platos/[id]/editar/page.tsx`
- Modify: `app/viandera/page.tsx`
- Modify: `components/viandera/TarjetaPlato.tsx`

**Interfaces:**
- Consumes: `ETIQUETAS_DIETARIAS` (Tarea 2).
- Produces: `viandas.etiquetas` cargado desde el formulario de alta/edición
  — la Tarea 5 (página pública) lee esta misma columna para mostrar los
  badges.

- [ ] **Step 1: Leer y guardar etiquetas en las Server Actions**

En `app/viandera/actions.ts`, en `crearPlato`, agregar después de la línea
que lee `foto`:

```typescript
  const etiquetas = formData.getAll("etiquetas").map(String);
```

Y agregar `etiquetas,` al objeto que se pasa a
`.from("viandas").insert({ ... })` (junto a `disponible: true,`).

En `actualizarPlato`, agregar la misma línea después de la que lee `foto`:

```typescript
  const etiquetas = formData.getAll("etiquetas").map(String);
```

Y agregar `etiquetas,` al objeto que se pasa a
`.from("viandas").update({ ... })` (junto a `disponible,`).

- [ ] **Step 2: Checkboxes en el formulario de plato**

En `components/viandera/FormularioPlato.tsx`:

Agregar el import:

```typescript
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";
```

Agregar `etiquetas: string[]` al tipo de `valoresIniciales` (junto a
`disponible: boolean`).

Agregar este bloque nuevo, entre el campo de "Foto" y el checkbox de
"Disponible" (el de "Disponible" solo se muestra en modo editar; este
bloque nuevo se muestra siempre, en ambos modos):

```tsx
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink/80">
          Apto para <span className="text-ink/40">(opcional)</span>
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ETIQUETAS_DIETARIAS.map((et) => (
            <label
              key={et.valor}
              className="flex items-center gap-2 text-sm text-ink/80"
            >
              <input
                type="checkbox"
                name="etiquetas"
                value={et.valor}
                defaultChecked={valoresIniciales?.etiquetas?.includes(et.valor)}
                className="h-4 w-4 rounded border-ink/25 text-coral focus:ring-coral/25"
              />
              {et.etiqueta}
            </label>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: Pasar etiquetas desde la página de edición**

En `app/viandera/platos/[id]/editar/page.tsx`, agregar `etiquetas` al
`.select(...)` (queda
`"id, nombre, descripcion, precio, tipo, foto_url, disponible, etiquetas"`)
y agregar `etiquetas: plato.etiquetas,` al objeto `valoresIniciales` que
se pasa a `<FormularioPlato>`.

- [ ] **Step 4: Mostrar etiquetas en la tarjeta del dashboard**

En `app/viandera/page.tsx`, agregar `etiquetas` al `.select(...)` de
`viandas` (queda
`"id, nombre, precio, tipo, foto_url, disponible, etiquetas"`).

En `components/viandera/TarjetaPlato.tsx`:

Agregar el import:

```typescript
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";
```

Agregar `etiquetas: string[];` al tipo `Plato`.

Agregar este bloque nuevo, justo después del párrafo del precio
(`{plato.precio != null && (...)}`) y antes del `<div className="mt-2 flex flex-wrap...">`:

```tsx
        {plato.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {plato.etiquetas.map((valor) => {
              const et = ETIQUETAS_DIETARIAS.find((e) => e.valor === valor);
              return et ? (
                <span
                  key={valor}
                  className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700"
                >
                  {et.etiqueta}
                </span>
              ) : null;
            })}
          </div>
        )}
```

- [ ] **Step 5: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador**

Con una cuenta de viandera de prueba: cargar un plato marcando 2-3
etiquetas, confirmar que aparecen como badges en la tarjeta del
dashboard; editarlo y desmarcar una, confirmar que se actualiza.

- [ ] **Step 7: Commit**

```bash
git add app/viandera/actions.ts components/viandera/FormularioPlato.tsx app/viandera/platos components/viandera/TarjetaPlato.tsx app/viandera/page.tsx
git commit -m "Add dietary tags to dishes"
```

---

## Task 5: Página pública de la viandera

**Files:**
- Create: `app/[slug]/page.tsx`

**Interfaces:**
- Consumes: `ETIQUETAS_DIETARIAS` (Tarea 2), `vianderas.slug` (Tarea 3),
  `viandas.etiquetas` (Tarea 4).
- Produces: la ruta pública en sí — no la consume ninguna tarea posterior,
  cierra el alcance de esta v1.

- [ ] **Step 1: Crear la página pública**

Crear `app/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";

export default async function VianderaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id, nombre, bio, telefono, activo")
    .eq("slug", slug)
    .maybeSingle();

  if (!viandera || !viandera.activo) {
    notFound();
  }

  const { data: platos } = await supabase
    .from("viandas")
    .select("id, nombre, precio, tipo, foto_url, etiquetas")
    .eq("vianderas_id", viandera.id)
    .eq("disponible", true)
    .order("created_at", { ascending: false });

  const iniciales = viandera.nombre
    .split(" ")
    .map((palabra) => palabra[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const whatsappHref = viandera.telefono
    ? `https://wa.me/${viandera.telefono.replace(/\D/g, "")}`
    : null;

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-ink/10 bg-card shadow-lg shadow-ink/5">
        <div className="flex items-center gap-3 border-b border-ink/10 bg-teal px-5 py-4 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 font-display text-lg font-bold">
            {iniciales}
          </div>
          <div className="flex-1">
            <p className="font-display font-semibold leading-tight">
              {viandera.nombre}
            </p>
            {viandera.bio && (
              <p className="text-xs text-white/75">{viandera.bio}</p>
            )}
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            Activa
          </span>
        </div>

        {(platos ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink/60">
            Todavía no hay platos cargados.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {(platos ?? []).map((plato) => (
              <li key={plato.id} className="flex gap-3 px-5 py-3.5">
                {plato.foto_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={plato.foto_url}
                    alt={plato.nombre}
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="flex flex-1 items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {plato.nombre}
                    </p>
                    <p className="text-xs text-ink/50">{plato.tipo}</p>
                    {plato.etiquetas.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {plato.etiquetas.map((valor) => {
                          const et = ETIQUETAS_DIETARIAS.find(
                            (e) => e.valor === valor,
                          );
                          return et ? (
                            <span
                              key={valor}
                              className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700"
                            >
                              {et.etiqueta}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  {plato.precio != null && (
                    <p className="whitespace-nowrap font-display text-sm font-semibold text-coral">
                      ${plato.precio.toLocaleString("es-AR")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {whatsappHref && (
          <div className="border-t border-ink/10 bg-paper/60 px-5 py-4">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-full bg-coral px-6 py-3 text-center text-sm font-medium text-white shadow-sm transition-all hover:bg-coral-600 hover:shadow-md active:scale-95"
            >
              Pedir por WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: sin errores. Confirmar en el output del build que
`/[slug]` aparece listada como ruta dinámica.

- [ ] **Step 3: Verificar en el navegador**

Con la cuenta de viandera de prueba de las tareas anteriores (que ya tiene
slug, teléfono, y al menos un plato disponible con foto y etiquetas):
1. Visitar `viandapp.ar/{su-slug}` (deslogueado, en una ventana privada si
   hace falta) → confirmar que se ve el perfil, el plato con foto y
   badges, y el botón de WhatsApp.
2. Pausar ese plato (`disponible = false`) desde el panel → confirmar que
   desaparece de la vidriera pública pero se sigue viendo en `/viandera`.
3. Poner la viandera como `activo = false` (a mano en Supabase) →
   confirmar que `/{slug}` da 404.
4. Visitar `viandapp.ar/no-existe-este-slug` → confirmar 404 también.
5. Confirmar que ninguna ruta existente (`/login`, `/admin`, `/viandera`,
   `/app`, `/registro`) se vio afectada — Next.js debe seguir
   resolviéndolas antes que `/[slug]`.

- [ ] **Step 4: Commit**

```bash
git add app/\[slug\]/page.tsx
git commit -m "Add the public viandera storefront page"
```

---

## Self-Review Notes

- **Cobertura de la spec:** las 4 secciones (modelo de datos, generación
  de slug, página pública, tags dietarios) tienen tarea — Tarea 1
  (modelo), Tarea 3 (slug), Tarea 5 (página pública), Tarea 4 (tags). La
  sección "Fuera de alcance" es una lista negativa, no requiere tarea.
- **Placeholders:** ninguno — cada Server Action, componente y bloque SQL
  está completo.
- **Consistencia de tipos:** `EstadoPerfil`/`EstadoPlato` no cambian de
  forma (mismo patrón `idle`/`error`/`ok` ya establecido). `Viandera.slug`
  y `Vianda.etiquetas` se agregan una sola vez en `types/index.ts` (Tarea
  2) y todas las tareas posteriores los consumen sin redefinirlos.
- **Reuso de componentes compartidos:** este plan reusa `campoClase` y
  `BotonEnviar` desde el arranque (no los duplica en ningún formulario
  nuevo) — a diferencia del plan anterior, que tuvo que corregir esto en
  una vuelta de fixes.
