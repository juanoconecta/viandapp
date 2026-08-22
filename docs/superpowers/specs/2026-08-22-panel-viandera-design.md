# Panel de viandera — Diseño

**Fecha:** 2026-08-22
**Estado:** Aprobado, pendiente de plan de implementación

## Resumen

Hoy cada `viandera` (fila en la tabla `vianderas`, y sus `viandas`) se carga a
mano desde el dashboard de Supabase. Este proyecto agrega un panel donde una
viandera invitada puede loguearse, editar su propio perfil (nombre, bio,
teléfono, ubicación) y administrar su menú (alta, edición, borrado y
disponibilidad de platos, con foto real) — reemplazando la carga manual.

También agrega un panel mínimo de administración (`/admin`, solo para el
dueño del proyecto) para invitar vianderas nuevas, porque hoy ese alta es
curada a mano y debe seguir siéndolo: cualquiera no puede autoregistrarse
como viandera.

## Fuera de alcance de esta v1

- El mapa/lista de vianderas para consumidores en la home — sigue sin
  mostrarse (la home sigue siendo la landing actual, sin cambios).
- Gestión de pedidos, notificaciones, stock por cantidad, días de entrega
  configurables. Es alta/edición simple del menú y el perfil, nada más.
- Foto de perfil de la viandera (usa iniciales como avatar, igual que la
  vista previa "DR — Doña Rosa" que ya existe en la landing). Solo los
  platos tienen foto.
- Cuentas de viandera por autoregistro — siguen siendo invitadas por el
  admin, igual que hoy son datos curados.
- Roles genéricos o multi-admin — hay un solo admin (el dueño del
  proyecto), identificado por email hardcodeado, no una tabla de roles.

## Modelo de datos

### Cambio a `vianderas`

```sql
alter table vianderas
  add column user_id uuid references auth.users(id) unique;
```

Nullable: queda `null` hasta que la viandera invitada acepta la invitación y
su cuenta se vincula a la fila (ver "Reclamo de cuenta" más abajo). `unique`
evita que dos filas de `vianderas` apunten a la misma cuenta.

### Políticas RLS nuevas

Las políticas públicas existentes (`vianderas activas son publicas`,
`viandas disponibles son publicas`) no cambian — el consumidor anónimo sigue
viendo solo lo activo/disponible.

Se agregan, para que una viandera vea y edite su propia fila incluso cuando
`activo`/`disponible` es `false`:

```sql
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
```

No se agregan políticas de INSERT para `vianderas`, ni de UPDATE para el
propio `user_id` desde el cliente — esas dos escrituras (alta de la fila,
vinculación inicial de `user_id`) corren del lado del servidor con la
service role key, nunca desde una policy pública. Esto evita que alguien
pueda auto-asignarse una `vianderas_id` ajena manipulando un request.

### Storage

Bucket nuevo `platos` (público para lectura, protegido para escritura):

```sql
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

Convención de path: `platos/{vianderas_id}/{vianda_id}-{timestamp}.{ext}`.

## Flujo de invitación (admin)

- Ruta `/admin`, gateada: la vista se renderiza server-side y verifica que
  el email del usuario logueado sea el email del admin (constante hardcodeada
  en el código — un solo admin, no hace falta más).
- Formulario: nombre + email. Al enviar, un Server Action con la service
  role key:
  1. Inserta la fila en `vianderas` (`nombre`, resto de campos en default/null).
  2. Llama `supabase.auth.admin.inviteUserByEmail(email, { data: { vianderas_id } })`,
     guardando el id de la fila recién creada en el `user_metadata` de la
     invitación.
- Debajo del formulario, tabla simple con las vianderas existentes y su
  estado (`user_id` nulo → "Invitada, pendiente"; con `user_id` → "Cuenta
  activa").

## Reclamo de cuenta (primer login de la viandera)

- La invitada recibe el mail de Supabase, hace click, define su contraseña
  (Supabase la lleva a un flujo de "set password" antes de dejarla entrar).
- La primera vez que su sesión llega a `/viandera`, un chequeo server-side:
  1. Lee `vianderas_id` del `user_metadata` de la sesión actual.
  2. Si existe y la fila de `vianderas` con ese id todavía tiene
     `user_id is null`, la actualiza a `auth.uid()` (con la service role key,
     un `UPDATE ... WHERE id = :vianderas_id AND user_id IS NULL` — atómico e
     idempotente, no pasa nada si corre dos veces).
- Transparente para la viandera: no ve ningún paso extra, solo entra a su
  panel ya vinculado.
- Si una cuenta llega a `/viandera` sin `vianderas_id` en el metadata y sin
  ninguna fila de `vianderas` vinculada a su `user_id` (un consumidor
  cualquiera intentando entrar), el middleware la redirige a `/app`.

## Panel de la viandera

Área nueva `/viandera`, gateada por el mismo middleware de auth que ya
protege `/app`, con una condición extra: la cuenta debe tener una fila de
`vianderas` vinculada (`user_id = auth.uid()`) — si no, redirige a `/app`
(es una cuenta de consumidor, no de viandera).

- **`/viandera`** — dashboard: resumen del perfil (nombre, estado activo) +
  grilla de sus platos (foto, nombre, precio, tipo, toggle
  disponible/no disponible inline, botones editar/borrar), botón
  "+ Agregar plato".
- **`/viandera/perfil`** — formulario: nombre, bio, teléfono, y selector de
  ubicación con **pin arrastrable sobre un mapa** (nuevo componente en
  `components/map`, variante de `ViandaMap` con un `Marker` `draggable:true`
  que reporta lat/lng al soltar — mismo patrón `next/dynamic` + `ssr:false`
  documentado en `CLAUDE.md`).
- **`/viandera/platos/nuevo`** — formulario de alta: nombre, descripción,
  precio, tipo (almuerzo/cena/ambos), input de archivo para la foto (sube a
  Storage antes de insertar la fila, o en la misma Server Action).
- **`/viandera/platos/[id]/editar`** — mismo formulario, precargado, más
  opción de borrar el plato (y su foto del bucket).

Visualmente: misma familia que el resto de la app (paper/ink/card/coral/teal,
Baloo 2 en títulos, Inter en texto) adaptando la densidad de tarjetas y la
sensación general de la referencia de Gromuse a un panel de gestión en vez
de una grilla de compra.

## Testing

Sin framework de testing automatizado (convención ya establecida en el
proyecto) — verificación por typecheck/lint/build más pruebas manuales en
browser: invitar una viandera de prueba, aceptar la invitación, cargar
perfil y al menos dos platos con foto, verificar que el toggle de
disponibilidad funciona, y que una cuenta de consumidor común no puede
entrar a `/viandera` ni a `/admin`.

## Riesgos / decisiones a vigilar

- El flujo de invitación de Supabase Auth (`admin.inviteUserByEmail`) y las
  escrituras con service role key requieren `SUPABASE_SERVICE_ROLE_KEY` en
  las env vars — **verificado: hoy `.env.local` solo tiene
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, falta
  agregarla** (se consigue en Supabase Dashboard → Project Settings → API →
  `service_role` secret). Es un prerequisito real, no hipotético — el plan
  de implementación debe incluir el paso de pedírsela al usuario y
  cargarla, tanto local como en las env vars de producción en Vercel. Nunca
  debe llevar el prefijo `NEXT_PUBLIC_` (es secreta, solo se usa
  server-side).
- El middleware ya gatea `/app` y ahora sumará lógica para `/viandera` y
  `/admin` — mantenerlo legible a medida que crece (ver los hallazgos
  menores ya pendientes sobre el matcher de `middleware.ts`, que aplican
  igual acá).
