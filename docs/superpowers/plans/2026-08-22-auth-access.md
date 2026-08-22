# Auth y acceso a /app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un consumidor puede registrarse y loguearse (email/contraseña o Google) para entrar a `/app`; sin sesión válida, cualquier intento de acceder a `/app` redirige a `/login`. La landing pública (`/`) no se toca.

**Architecture:** Next.js middleware refresca la sesión de Supabase en cada request y bloquea `/app/*` sin usuario autenticado. Server Actions en `app/auth/actions.ts` hacen el trabajo real contra Supabase Auth (`signInWithPassword`, `signUp`, `signInWithOAuth`, `signOut`). Los formularios siguen el mismo patrón que `FormularioInteres.tsx` (`useActionState`, Server Action con `<form action={...}>`, sin `AnimatePresence` envolviendo el `<form>`).

**Tech Stack:** Next.js 16 (App Router), Supabase Auth vía `@supabase/ssr` 0.12.4 (ya instalado), TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-22-auth-access-design.md`

## Global Constraints

- La landing (`/`) y todo lo que no esté bajo `/app` sigue sin requerir login.
- Solo rutas bajo `/app` quedan protegidas por el middleware.
- Textos de interfaz en español (es-AR), mismo tono que el resto del sitio.
- Paleta y tipografía existentes: fondo `bg-paper`, texto `text-ink`, tarjetas `bg-card`, acento `text-coral` / `bg-coral`, display `font-display` (Baloo 2). Reusar la clase de input `campoClase` del mismo patrón que `FormularioInteres.tsx`.
- No se crean tablas nuevas en Supabase — la autenticación usa `auth.users`, gestionada por Supabase.
- Nunca exponer el mensaje de error crudo de Supabase al usuario — siempre un mensaje genérico en español.
- Nunca envolver un `<form action={serverAction}>` con `AnimatePresence mode="wait"` ni `motion.form` (bug documentado en `CLAUDE.md`).
- Este proyecto no tiene framework de tests (no hay Jest/Vitest instalado) — no agregar uno como parte de este plan. Cada tarea se verifica con `npx tsc --noEmit`, `npx eslint .`, `npx next build`, y una verificación funcional en el navegador (dev server), igual que el resto del código de este repo.
- La configuración de Google OAuth (credenciales en Google Cloud + URLs permitidas en el dashboard de Supabase) la hace el usuario fuera de este plan — está marcada explícitamente en la Tarea 5.

---

## Task 1: Placeholder de `/app`

**Files:**
- Create: `app/app/layout.tsx`
- Create: `app/app/page.tsx`

**Interfaces:**
- Consumes: `lib/supabase/server.ts` → `createClient(): Promise<SupabaseClient<Database>>` (ya existe)
- Produces: la ruta `/app` renderiza un placeholder. Sin protección todavía (eso es la Tarea 2) — cualquiera puede visitarla en esta tarea.

- [ ] **Step 1: Crear el layout del área protegida**

`app/app/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</div>
  );
}
```

- [ ] **Step 2: Crear la página placeholder**

`app/app/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-ink/10 bg-card p-10 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">
        ¡Bienvenido{user?.email ? `, ${user.email}` : ""}!
      </h1>
      <p className="text-ink/60">
        Ya estás adentro. Acá va a vivir la webapp de compras.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: los tres terminan sin errores.

- [ ] **Step 4: Verificar en el navegador**

Levantar `npm run dev`, visitar `http://localhost:3000/app`.
Expected: se ve la tarjeta "¡Bienvenido!" (sin email, porque todavía no hay usuario logueado — eso es esperado en esta tarea).

- [ ] **Step 5: Commit**

```bash
git add app/app/layout.tsx app/app/page.tsx
git commit -m "Add placeholder shell for the protected /app section"
```

---

## Task 2: Middleware — el gate

**Files:**
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts` (raíz del proyecto)
- Create: `app/login/page.tsx` (stub mínimo, se reemplaza en la Tarea 3)

**Interfaces:**
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>` — usado únicamente por `middleware.ts`.
- Produces: cualquier request a `/app/*` sin sesión válida redirige a `/login?redirect=<pathname original>`.

- [ ] **Step 1: Crear el helper de refresco de sesión**

`lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Crear el middleware raíz**

`middleware.ts` (en la raíz del proyecto, al lado de `package.json`):

```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Crear el stub de `/login`**

`app/login/page.tsx`:

```tsx
export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">
        Iniciar sesión
      </h1>
      <p className="mt-2 text-ink/60">
        El formulario real se agrega en la próxima tarea.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: los tres terminan sin errores.

- [ ] **Step 5: Verificar el redirect en el navegador**

Levantar `npm run dev`. En una pestaña nueva (o incógnito, para asegurarse de no tener sesión), visitar `http://localhost:3000/app`.
Expected: la URL cambia a `http://localhost:3000/login?redirect=%2Fapp` y se ve el stub "Iniciar sesión".

Visitar `http://localhost:3000/`.
Expected: la landing carga normal, sin redirect (confirma que el middleware no toca rutas fuera de `/app`).

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/middleware.ts middleware.ts app/login/page.tsx
git commit -m "Add auth middleware gating /app behind a session check"
```

---

## Task 3: Login y registro con email/contraseña

**Files:**
- Create: `app/auth/actions.ts`
- Create: `components/auth/FormularioLogin.tsx`
- Create: `components/auth/FormularioRegistro.tsx`
- Modify: `app/login/page.tsx` (reemplaza el stub de la Tarea 2)
- Create: `app/registro/page.tsx`

**Interfaces:**
- Produces: `type EstadoAuth = { status: "idle" } | { status: "error"; mensaje: string }` — usado por ambos formularios.
- Produces: `iniciarSesion(prevState: EstadoAuth, formData: FormData): Promise<EstadoAuth>` — espera los campos `email`, `password`, `redirect` en el `FormData`. Redirige a `redirect` (o `/app`) si el login es exitoso; nunca retorna en el camino feliz porque `redirect()` lanza internamente.
- Produces: `registrarse(prevState: EstadoAuth, formData: FormData): Promise<EstadoAuth>` — espera `nombre`, `email`, `password`. Redirige a `/app` si el registro es exitoso.
- Consumes (Tarea 5 la usa): ninguna todavía — el botón de Google se agrega en la Tarea 5.

- [ ] **Step 1: Crear las Server Actions de login y registro**

`app/auth/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoAuth =
  | { status: "idle" }
  | { status: "error"; mensaje: string };

export async function iniciarSesion(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/app");

  if (!email || !password) {
    return { status: "error", mensaje: "Completá tu email y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", mensaje: "Email o contraseña incorrectos." };
  }

  redirect(redirectTo);
}

export async function registrarse(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nombre || !email || !password) {
    return { status: "error", mensaje: "Completá todos los campos." };
  }

  if (password.length < 6) {
    return {
      status: "error",
      mensaje: "La contraseña tiene que tener al menos 6 caracteres.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        status: "error",
        mensaje: "Ya existe una cuenta con ese email. Iniciá sesión.",
      };
    }
    return {
      status: "error",
      mensaje: "No pudimos crear tu cuenta. Probá de nuevo.",
    };
  }

  redirect("/app");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Crear el formulario de login**

`components/auth/FormularioLogin.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { iniciarSesion, type EstadoAuth } from "@/app/auth/actions";

const campoClase =
  "rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

const estadoInicial: EstadoAuth = { status: "idle" };

function BotonEnviar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Entrando..." : "Iniciar sesión"}
    </button>
  );
}

export default function FormularioLogin({ redirectTo }: { redirectTo: string }) {
  const [estado, formAction] = useActionState(iniciarSesion, estadoInicial);

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirect" value={redirectTo} />

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
            placeholder="vos@ejemplo.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink/80">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className={campoClase}
            placeholder="••••••••"
          />
        </div>

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        <BotonEnviar />
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-medium text-coral hover:text-coral-600">
          Registrate
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Crear el formulario de registro**

`components/auth/FormularioRegistro.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { registrarse, type EstadoAuth } from "@/app/auth/actions";

const campoClase =
  "rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

const estadoInicial: EstadoAuth = { status: "idle" };

function BotonEnviar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </button>
  );
}

export default function FormularioRegistro() {
  const [estado, formAction] = useActionState(registrarse, estadoInicial);

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
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
            placeholder="Tu nombre"
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
            placeholder="vos@ejemplo.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink/80">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className={campoClase}
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        <BotonEnviar />
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-coral hover:text-coral-600">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Reemplazar el stub de `/login`**

`app/login/page.tsx` (reemplaza completo el contenido de la Tarea 2):

```tsx
import FormularioLogin from "@/components/auth/FormularioLogin";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/app";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold text-ink">
        Iniciar sesión
      </h1>
      <p className="mt-2 text-center text-ink/60">
        Entrá para pedir tus viandas.
      </p>

      {params.error === "oauth" && (
        <p className="mt-4 text-center text-sm text-coral-700">
          No pudimos completar el login con Google. Probá de nuevo.
        </p>
      )}

      <div className="mt-8">
        <FormularioLogin redirectTo={redirectTo} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Crear `/registro`**

`app/registro/page.tsx`:

```tsx
import FormularioRegistro from "@/components/auth/FormularioRegistro";

export default function RegistroPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold text-ink">
        Crear cuenta
      </h1>
      <p className="mt-2 text-center text-ink/60">
        Registrate para empezar a pedir tus viandas.
      </p>

      <div className="mt-8">
        <FormularioRegistro />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: los tres terminan sin errores.

- [ ] **Step 7: Verificar el flujo de registro en el navegador**

Levantar `npm run dev`, visitar `http://localhost:3000/registro`, completar nombre/email/contraseña con un email de prueba y enviar.
Expected: redirige a `/app` y se ve "¡Bienvenido, `<email>`!" (confirma que `app/app/page.tsx` de la Tarea 1 ahora sí encuentra un usuario).

Confirmar en el dashboard de Supabase → Authentication → Users que aparece el usuario nuevo.

- [ ] **Step 8: Verificar el flujo de login y el error de credenciales inválidas**

Cerrar la pestaña (o borrar cookies), visitar `http://localhost:3000/login`, probar primero con una contraseña incorrecta.
Expected: se ve el mensaje "Email o contraseña incorrectos." sin salir de la página.

Reintentar con la contraseña correcta.
Expected: redirige a `/app`.

- [ ] **Step 9: Commit**

```bash
git add app/auth/actions.ts components/auth/FormularioLogin.tsx components/auth/FormularioRegistro.tsx app/login/page.tsx app/registro/page.tsx
git commit -m "Add email/password login and signup flows"
```

---

## Task 4: Logout

**Files:**
- Modify: `app/app/layout.tsx`

**Interfaces:**
- Consumes: `cerrarSesion(): Promise<void>` de `app/auth/actions.ts` (creada en la Tarea 3).

- [ ] **Step 1: Agregar el botón de logout al layout de `/app`**

`app/app/layout.tsx` (reemplaza completo el contenido de la Tarea 1):

```tsx
import type { ReactNode } from "react";
import { cerrarSesion } from "@/app/auth/actions";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex justify-end">
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="text-sm font-medium text-ink/60 transition-colors hover:text-coral"
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

- [ ] **Step 2: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: los tres terminan sin errores.

- [ ] **Step 3: Verificar el logout en el navegador**

Con una sesión iniciada en `/app`, click en "Cerrar sesión".
Expected: redirige a `/`.

Volver a visitar `http://localhost:3000/app` en la misma pestaña.
Expected: redirige a `/login?redirect=%2Fapp` (confirma que la sesión quedó realmente cerrada, no solo la UI).

- [ ] **Step 4: Commit**

```bash
git add app/app/layout.tsx
git commit -m "Add logout button to the protected app shell"
```

---

## Task 5: Login con Google

**Requiere configuración externa antes de poder probar esta tarea end-to-end** (la hace el usuario, no el agente):
1. Crear un client OAuth "Web application" en Google Cloud Console con `https://<proyecto>.supabase.co/auth/v1/callback` como redirect URI autorizado.
2. Cargar el Client ID y Client Secret en Supabase Dashboard → Authentication → Providers → Google.
3. Agregar `http://localhost:3000` y `https://viandapp.ar` en Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.

Si esta configuración todavía no está hecha, el código de esta tarea igual se puede escribir y compilar — el flujo simplemente va a fallar al llegar a Google con un error de configuración hasta que el usuario complete esos tres pasos.

**Files:**
- Modify: `app/auth/actions.ts`
- Create: `app/auth/callback/route.ts`
- Modify: `components/auth/FormularioLogin.tsx`
- Modify: `components/auth/FormularioRegistro.tsx`

**Interfaces:**
- Produces: `iniciarSesionConGoogle(formData: FormData): Promise<void>` en `app/auth/actions.ts` — espera el campo `redirect` en el `FormData`, redirige el navegador a la URL de consentimiento de Google.
- Produces: `GET /auth/callback` — recibe `?code=` y `?redirect=` de vuelta de Google/Supabase, intercambia el code por una sesión, redirige a `redirect` (o a `/login?error=oauth` si falla).

- [ ] **Step 1: Agregar la Server Action de login con Google**

Agregar al final de `app/auth/actions.ts` (no reemplaza nada existente):

```ts
import { headers } from "next/headers";

export async function iniciarSesionConGoogle(formData: FormData) {
  const redirectTo = String(formData.get("redirect") ?? "/app");
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}
```

Nota: el `import { headers } from "next/headers"` va arriba del archivo junto a los otros imports, no repetido a mitad del archivo.

- [ ] **Step 2: Crear el Route Handler del callback**

`app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
```

- [ ] **Step 3: Agregar el botón de Google al login**

En `components/auth/FormularioLogin.tsx`, importar `iniciarSesionConGoogle` junto a `iniciarSesion`:

```tsx
import { iniciarSesion, iniciarSesionConGoogle, type EstadoAuth } from "@/app/auth/actions";
```

Y agregar, entre el cierre de `</form>` del login y el `<p>` de "¿No tenés cuenta?":

```tsx
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink/10" />
        <span className="text-xs text-ink/40">o</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>

      <form action={iniciarSesionConGoogle}>
        <input type="hidden" name="redirect" value={redirectTo} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-card"
        >
          Continuar con Google
        </button>
      </form>
```

- [ ] **Step 4: Agregar el botón de Google al registro**

En `components/auth/FormularioRegistro.tsx`, importar `iniciarSesionConGoogle` junto a `registrarse`:

```tsx
import { registrarse, iniciarSesionConGoogle, type EstadoAuth } from "@/app/auth/actions";
```

Y agregar el mismo bloque que en el Step 3, entre el cierre de `</form>` del registro y el `<p>` de "¿Ya tenés cuenta?" — con `redirect` fijo en `/app` ya que el registro no viene de un intento de acceso a una subruta:

```tsx
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink/10" />
        <span className="text-xs text-ink/40">o</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>

      <form action={iniciarSesionConGoogle}>
        <input type="hidden" name="redirect" value="/app" />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-card"
        >
          Continuar con Google
        </button>
      </form>
```

- [ ] **Step 5: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint . && npx next build`
Expected: los tres terminan sin errores.

- [ ] **Step 6: Verificar en el navegador que el botón aparece**

Levantar `npm run dev`, visitar `/login` y `/registro`.
Expected: en ambas se ve el separador "o" y el botón "Continuar con Google" debajo del formulario.

- [ ] **Step 7: Verificar el flujo completo (requiere la configuración externa del inicio de esta tarea)**

Click en "Continuar con Google" desde `/login`.
Expected: redirige a la pantalla de consentimiento de Google, y al aceptar vuelve a `/app` ya logueado.

Si en vez de eso aparece un error de Supabase sobre el provider "Google" no habilitado, es porque la configuración externa (Step del principio de esta tarea) todavía no está hecha — no es un bug del código.

- [ ] **Step 8: Commit**

```bash
git add app/auth/actions.ts app/auth/callback/route.ts components/auth/FormularioLogin.tsx components/auth/FormularioRegistro.tsx
git commit -m "Add Google OAuth login"
```

---

## Self-Review Notes

- **Cobertura del spec:** los 5 flujos del spec (registro, login, login con Google, acceso sin sesión, logout) están cada uno cubierto por una tarea con verificación explícita. La sección "Configuración externa" del spec está repetida como bloque de advertencia al inicio de la Tarea 5, en el punto donde efectivamente hace falta.
- **Consistencia de tipos:** `EstadoAuth` se define una sola vez en `app/auth/actions.ts` (Tarea 3) y se importa igual en ambos formularios. `iniciarSesion` y `registrarse` comparten la misma firma `(prevState: EstadoAuth, formData: FormData) => Promise<EstadoAuth>`, compatible con `useActionState`. `cerrarSesion` y `iniciarSesionConGoogle` no devuelven estado (siempre redirigen), por eso se usan como `action` directo de un `<form>` sin `useActionState`, no como los otros dos.
- **Fuera de alcance respetado:** ninguna tarea toca `interesados_viandera`, ni agrega recuperación de contraseña, ni construye contenido real de `/app` más allá del placeholder — como marca el spec.
