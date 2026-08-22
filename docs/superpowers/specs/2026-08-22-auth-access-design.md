# Auth y acceso a `/app` — diseño

**Fecha**: 2026-08-22
**Estado**: aprobado, pendiente de implementación

## Contexto

ViandApp hoy es una landing pública (`/`) que capta leads de vianderas vía
un formulario. El siguiente paso es empezar a construir la webapp de
compras real (estilo Gromuse, ver referencia en la sección "Fuera de
alcance"), que va a vivir en `/app`. Antes de tener nada ahí, hace falta
que esa sección quede detrás de un login — tanto porque la webapp va a
manejar cuentas de usuario reales (carrito, pedidos) como porque no debe
ser pública mientras está en construcción y se prueba online.

Este documento cubre **solo la pieza de autenticación y acceso**. El
diseño de la webapp de compras en sí (layout, componentes, catálogo) es
un proyecto aparte que se brainstormea por separado.

## Objetivo

Un consumidor puede crear una cuenta y loguearse (email/contraseña o
Google) para acceder a `/app`. Sin sesión válida, cualquier intento de
entrar a `/app` o sus subrutas redirige a `/login`. La landing pública
(`/`) no se ve afectada — sigue sin requerir login.

## Fuera de alcance

- El diseño/contenido real de `/app` (la webapp de compras estilo
  [Gromuse](https://dribbble.com/shots/22774990-Gromuse-Grocery-Shopping-Website)).
  En esta iteración, `/app` es un placeholder mínimo que confirma que el
  login funcionó.
- Cuentas o login para vianderas — siguen siendo leads manuales en
  `interesados_viandera`, sin cuenta propia todavía.
- Recuperación de contraseña ("olvidé mi contraseña") — se puede sumar
  después sin romper nada de este diseño; no bloquea la primera versión
  testeable.
- Perfil de usuario editable, verificación de email obligatoria antes de
  usar la app, roles/permisos — nada de eso existe todavía.

## Arquitectura

Next.js middleware (`middleware.ts` en la raíz del proyecto) intercepta
todas las requests. Usa `@supabase/ssr` para:

1. Refrescar la sesión de Supabase en cada request (patrón estándar de
   Supabase SSR — sin esto, las sesiones expiran de forma inconsistente).
2. Si el pathname empieza con `/app` y no hay usuario autenticado,
   redirigir a `/login?redirect=<pathname original>`.

El resto del sitio (`/`, `/login`, `/registro`, assets, `/auth/callback`)
pasa sin chequeo de sesión — no queremos loguear al usuario a la fuerza
en la landing.

Autenticación real vía Supabase Auth (ya es el backend del proyecto,
`@supabase/ssr` y `@supabase/supabase-js` ya están instalados). No se
necesita tabla propia de usuarios: Supabase gestiona `auth.users`
automáticamente.

## Rutas y archivos nuevos

```
middleware.ts                          # el gate, corre en cada request
lib/supabase/middleware.ts             # helper de refresco de sesión para el middleware
app/login/page.tsx                     # Server Component: layout + <FormularioLogin />
app/registro/page.tsx                  # Server Component: layout + <FormularioRegistro />
app/auth/actions.ts                    # Server Actions: login, registro, logout, login con Google
app/auth/callback/route.ts             # Route Handler: recibe el code de vuelta del OAuth de Google
components/auth/FormularioLogin.tsx    # Client Component, email+contraseña, botón "Continuar con Google"
components/auth/FormularioRegistro.tsx # Client Component, email+contraseña+confirmación
app/app/layout.tsx                     # shell de la webapp de compras (placeholder por ahora)
app/app/page.tsx                       # placeholder: "Bienvenido, ya estás adentro"
```

`components/layout/Header.tsx` ya tiene un link "Ingresar" apuntando a
`/login` — no hace falta tocarlo.

## Flujos

**Registro (email/contraseña)**
1. Usuario completa nombre, email, contraseña en `/registro`.
2. Server Action llama `supabase.auth.signUp()`.
3. Si Supabase tiene confirmación de email activada por default, se le
   avisa al usuario que revise su casilla; si no, queda logueado directo
   y se redirige a `/app`. (Definir cuál de los dos comportamientos usar
   al implementar — ver "Preguntas abiertas".)

**Login (email/contraseña)**
1. Usuario completa email + contraseña en `/login`.
2. Server Action llama `supabase.auth.signInWithPassword()`.
3. Éxito → redirige a `/app` (o al `?redirect=` original si vino de un
   intento de acceso directo a una subruta de `/app`).
4. Error (credenciales inválidas) → el form re-renderiza con un mensaje
   de error inline, mismo patrón que `FormularioInteres.tsx`
   (`useActionState`).

**Login con Google**
1. Usuario click en "Continuar con Google" en `/login` o `/registro`.
2. Server Action llama `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback' } })`
   y redirige al usuario a la URL que devuelve Supabase.
3. Google redirige de vuelta a `/auth/callback?code=...`.
4. El Route Handler intercambia el code por una sesión
   (`supabase.auth.exchangeCodeForSession`) y redirige a `/app`.

**Acceso a `/app` sin sesión**
1. Usuario entra directo a `/app` (o cualquier subruta) sin estar
   logueado.
2. El middleware no encuentra sesión válida → redirige a
   `/login?redirect=/app`.

**Logout**
1. Botón "Cerrar sesión" (va a vivir en `app/app/layout.tsx` por ahora,
   ya que no hay nav de usuario armada todavía) dispara una Server
   Action que llama `supabase.auth.signOut()` y redirige a `/`.

## Manejo de errores

- Credenciales inválidas en login → mensaje inline "Email o contraseña
  incorrectos", el usuario reintenta sin perder lo que ya tipeó.
- Email ya registrado en `/registro` → mensaje inline "Ya existe una
  cuenta con ese email. ¿Querés iniciar sesión?" con link a `/login`.
- Falla el intercambio de code en `/auth/callback` (ej. usuario canceló
  el login de Google, o el code expiró) → redirige a
  `/login?error=oauth` y el form de login muestra "No pudimos
  completar el login con Google. Probá de nuevo."
- Cualquier otro error inesperado de Supabase en las Server Actions →
  mismo patrón que `anotarseComoInteresada`: mensaje genérico, no se
  expone el error crudo de Supabase al usuario.

## Configuración externa (la hace el usuario, no Claude)

1. **Google OAuth**: crear un client OAuth en Google Cloud Console
   (tipo "Web application"), con
   `https://<proyecto>.supabase.co/auth/v1/callback` como redirect URI
   autorizado. Copiar Client ID y Client Secret a Supabase Dashboard →
   Authentication → Providers → Google.
2. **URLs permitidas en Supabase**: agregar `http://localhost:3000` (dev)
   y `https://viandapp.ar` (producción) en Authentication → URL
   Configuration → Redirect URLs, si no el login con Google falla en uno
   de los dos entornos.
3. **Confirmación de email**: decidir en Supabase Dashboard →
   Authentication → Providers → Email si "Confirm email" queda activado
   o no para esta primera etapa (ver "Preguntas abiertas").

## Testing / verificación

En local (`npm run dev`) y después en producción una vez configurado
Google:

- Registro con email crea un usuario nuevo (verificable en Supabase
  Dashboard → Authentication → Users).
- Login con email y contraseña correctos entra a `/app`.
- Login con credenciales incorrectas muestra el error inline y no entra.
- Entrar a `/app` sin sesión (pestaña incógnito) redirige a `/login`.
- Login con Google completa el flujo end-to-end y entra a `/app`.
- Logout limpia la sesión — volver a `/app` después de logout vuelve a
  redirigir a `/login`.

## Preguntas abiertas (a resolver en el plan de implementación)

- ¿Confirmación de email obligatoria antes del primer login, o se deja
  desactivada para simplificar las pruebas iniciales? Recomendación:
  desactivada por ahora (menos fricción para probar), activarla más
  adelante antes de invitar usuarios reales.
- Copy exacto de los formularios de login/registro (labels, botón,
  textos de error) — se define durante la implementación siguiendo el
  tono ya establecido en `FormularioInteres.tsx`.
