# Configuración de envíos y adhesión a Puni — Diseño

**Fecha:** 2026-09-04 (revisión correctiva 2026-09-04)
**Estado:** Corregido tras revisión de Codex sobre el commit `4196de3` —
pendiente de una segunda revisión antes de implementar. Cambios de esta
revisión: la tabla `puni_adhesiones` queda **totalmente privada** (§5,
sin policy pública de SELECT — la superficie pública se sirve por
consulta server-only), el costo de envío mediante Puni lo configura **la
vendedora**, no el admin (§3, §4, §7, §8), y costo `null` deshabilita la
modalidad en el checkout (§3, ver spec de Carrito y pedidos invariante
4).
**Depende de:** nada técnicamente. Es prerequisito de Carrito y pedidos
(necesita `costo_envio_propio`/`cobertura_envio` y la consulta
server-only de adhesiones aprobadas) — ver orden recomendado en el
reporte final.

## 1. Objetivo

Dos cosas separadas que comparten tabla por vivir ambas "a nivel de
cocina":

1. Que cada vendedora configure cómo entrega (retiro / envío propio, costo,
   cobertura) — hoy `vianderas.ofrece_retiro`/`ofrece_envio` existen en el
   schema pero **no están expuestos en `FormularioPerfil.tsx`** (verificado
   leyendo el componente actual) — esta entrega los agrega a la UI además
   de sumar costo y cobertura.
2. Un flujo de solicitud → aprobación administrada para que una vendedora
   que ya contrató Puni por su cuenta pueda mostrarlo en ViandApp — sin que
   pueda autodeclararse adherida, y donde **el admin solo verifica y
   resuelve la adhesión** (aprueba/rechaza/suspende/revoca) — el costo que
   la vendedora cobra al comprador por ese envío lo fija ella misma, una
   vez aprobada, igual que fija el costo de su envío propio.

## 2. Invariante central

> "El vendedor no puede autodeclararse adherido... el administrador de
> ViandApp... es el único que puede aprobar, rechazar, suspender o revocar
> la adhesión."

Esto se refuerza en **dos capas**, no solo en la UI:

- **RLS**: la policy de `insert`/`update` de la vendedora sobre
  `puni_adhesiones` solo permite dejar `estado = 'pendiente'` (al
  solicitar o re-solicitar) o cambiar `costo_envio_puni` mientras
  `estado` sigue siendo `'aprobada'` (§6) — nunca puede escribir
  `estado = 'aprobada'` ella misma. Ninguna combinación de requests HTTP
  directos a Supabase (bypaseando la UI) se lo permite.
- **Server Action**: las transiciones de `estado`
  (`aprobada`/`rechazada`/`suspendida`/`revocada`) viven en
  `app/admin/actions.ts`, gateadas por `esAdmin()`, usando
  `createAdminClient()` — mismo patrón que `invitarViandera`. El admin
  **nunca** carga `costo_envio_puni` — esa responsabilidad es
  exclusivamente de la vendedora.

## 3. Modelo de datos

### Extensión de `vianderas` (envío propio, a nivel de cocina — no de plato)

```sql
alter table public.vianderas
  add column if not exists costo_envio_propio numeric check (costo_envio_propio >= 0),
  add column if not exists cobertura_envio text;
```

- `costo_envio_propio` nullable: `null` significa "envío propio ofrecido
  pero sin una tarifa cargada todavía" — **no** "gratis", y **no**
  utilizable en un pedido. `0` sí significa gratis, explícitamente. Ver
  spec de Carrito y pedidos, invariante 4: una modalidad cuyo costo
  resuelve a `null` queda deshabilitada en el checkout, nunca se
  convierte en `0` ni en "a coordinar" dentro de un pedido cuyo total
  pretende ser exacto. La UI debe distinguir un campo vacío de un campo
  en `0`.
- `cobertura_envio` es texto libre en esta entrega (ej. "Barrio Fátima y
  alrededores") — no hay geocoding ni polígonos. Consistente con el resto
  del proyecto, que ya usa `vianderas.barrio` como texto libre en vez de
  una tabla de barrios normalizada.
- Ambas columnas son irrelevantes si `ofrece_envio = false` — la UI las
  oculta en ese caso, pero el schema no lo fuerza con un constraint (se
  valida en el Server Action de `actualizarPerfil`, no en la base).

### `puni_adhesiones`

Una fila por viandera representa su estado **actual** (no historial
completo — el historial de cambios de estado vive en `crm_interacciones`
una vez que CRM exista y el admin decida cargarlo ahí; ver spec de CRM
§7 — esta tabla no duplica ese concepto, solo guarda el estado vigente y
cuándo se resolvió por última vez).

```sql
create table public.puni_adhesiones (
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
```

- `unique (viandera_id)`: una viandera tiene a lo sumo una fila — re-pedir
  después de un rechazo actualiza la misma fila (vuelve a `pendiente`), no
  crea una nueva.
- `costo_envio_puni` **lo configura la vendedora**, exclusivamente cuando
  `estado = 'aprobada'` (§6) — el admin nunca lo toca. Igual que
  `costo_envio_propio`: `null` = sin tarifa cargada = modalidad "envío
  mediante Puni" no disponible en el checkout todavía, aunque la
  adhesión esté aprobada.
- `resuelto_por` es el email del admin que aprobó/rechazó/suspendió/
  revocó (mismo criterio que `ADMIN_EMAIL`, no hay tabla de roles
  todavía) — texto, no FK a `auth.users`.
- `nota_admin`: texto interno (ej. motivo de un rechazo) — **nunca
  público**. No existe ninguna consulta ni vista accesible desde
  `anon`/`authenticated` que pueda devolver esta columna (§5) — no es
  solo "no aparece en la vista pública", es que la tabla entera no tiene
  ninguna vía de lectura pública en absoluto.

## 4. Transiciones de estado válidas

| Desde | Hacia | Quién |
|---|---|---|
| (sin fila) | `pendiente` | Vendedora, al solicitar |
| `pendiente` | `aprobada` / `rechazada` | Admin (verifica y resuelve — nunca carga costo) |
| `aprobada` | `suspendida` / `revocada` | Admin |
| `suspendida` | `aprobada` / `revocada` | Admin |
| `rechazada` | `pendiente` | Vendedora, al re-solicitar |
| `revocada` | `pendiente` | Vendedora, al re-solicitar |

Por separado, dentro del estado `aprobada` (no es una transición de
`estado`, es una actualización de `costo_envio_puni` mientras `estado`
se mantiene `'aprobada'`): **Vendedora**, en cualquier momento mientras
la adhesión siga aprobada — puede cargar o actualizar el costo que
cobra por "Envío mediante Puni" cuantas veces quiera.

Cualquier otra transición de `estado` (ej. `pendiente` → `suspendida`
directo, o la vendedora intentando `aprobada` → cualquier cosa) se
rechaza — en el Server Action con un `switch` explícito de transiciones
válidas, y en RLS como red de seguridad para el camino de la vendedora
(ver §6).

## 5. Qué se muestra públicamente

Solo cuando `estado = 'aprobada'` **y** `costo_envio_puni is not null`:

1. Insignia pública "Adherido a Puni" en `/{slug}` y en las tarjetas de
   `/explorar` (la insignia en sí solo depende de `estado = 'aprobada'`
   — no depende de si ya cargó costo; una vendedora recién aprobada
   muestra la insignia aunque todavía no pueda ofrecer la modalidad en
   el carrito).
2. La opción "Envío mediante Puni" aparece en el carrito (spec de
   Carrito y pedidos) — solo si además hay un `costo_envio_puni`
   cargado.

**La tabla `puni_adhesiones` no tiene ninguna policy de RLS que permita
`select` a `anon` ni `authenticated`.** Queda completamente privada —
ni siquiera con acceso limitado a dos columnas vía una vista
`security_invoker`, porque eso todavía depende de que exista una policy
de base que le dé a `anon` algún tipo de acceso de lectura sobre las
filas, y ese es exactamente el tipo de superficie que esta revisión
elimina.

En cambio, toda lectura pública de esta información pasa por una
**consulta server-only**, ejecutada en Server Components/Server Actions
con `createAdminClient()` (bypasea RLS por ser `service_role`, nunca
llega a un cliente de navegador), seleccionando explícitamente solo las
columnas necesarias — nunca `select('*')`:

```ts
// lib/envios/adhesionPublica.ts — ver plan para la implementación completa
export async function adhesionesAprobadas(
  vianderaIds: string[],
): Promise<Map<string, { costoEnvioPuni: number | null }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("puni_adhesiones")
    .select("viandera_id, costo_envio_puni")
    .eq("estado", "aprobada")
    .in("viandera_id", vianderaIds);
  // ...
}
```

Esta función nunca selecciona `nota_admin`, `resuelto_por`,
`resuelto_en`, ni `estado` real más allá del filtro — el `select`
explícito es en sí mismo el control de seguridad, reforzado por el
hecho de que ninguna otra vía (RLS pública, vista) existe para acceder a
la tabla. Como esta app ya renderiza todo el storefront server-side
(`buscarPlatos`, `app/[slug]/page.tsx` — nunca hay un cliente Supabase de
navegador consultando estas tablas), esto no agrega latencia ni
complejidad nueva: es el mismo patrón que ya usa el resto del código.

## 6. Acceso y RLS

```sql
alter table public.puni_adhesiones enable row level security;

-- Vendedora ve su propia fila (con nota_admin y todo — es su propia
-- solicitud, tiene derecho a ver por qué la rechazaron).
create policy "viandera ve su propia adhesion"
  on public.puni_adhesiones for select
  using (viandera_id in (select id from public.vianderas where user_id = auth.uid()));

-- Vendedora solicita por primera vez: solo puede insertar en 'pendiente',
-- sin costo cargado.
create policy "viandera solicita adhesion"
  on public.puni_adhesiones for insert
  with check (
    viandera_id in (select id from public.vianderas where user_id = auth.uid())
    and estado = 'pendiente'
    and costo_envio_puni is null
    and resuelto_por is null
  );

-- Vendedora re-solicita después de un rechazo/revocación, O configura su
-- costo mientras está aprobada. Dos casos válidos, reforzados por
-- trigger (no expresables completos solo con with check, ver abajo).
create policy "viandera actualiza su propia adhesion"
  on public.puni_adhesiones for update
  using (viandera_id in (select id from public.vianderas where user_id = auth.uid()));

-- Nadie mas (ni anon ni authenticated) tiene ninguna policy de select
-- sobre esta tabla mas alla de "viandera ve su propia adhesion". La
-- superficie publica se sirve exclusivamente via consulta server-only
-- (§5), nunca via RLS.
```

Como el `using`/`with check` de una sola policy de `update` no puede
expresar limpiamente "o bien esta transición de estado, o bien este
cambio de columna, pero nunca ambos a la vez ni nada más", el control
real de qué puede cambiar la vendedora vive en un trigger:

```sql
create or replace function public.puni_adhesiones_validar_update_vendedora()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new; -- admin, vía createAdminClient(), sin restricción acá
  end if;

  -- Caso 1: re-solicitar tras rechazo/revocación.
  if old.estado in ('rechazada', 'revocada') and new.estado = 'pendiente' then
    if new.costo_envio_puni is distinct from old.costo_envio_puni
       or new.nota_admin is distinct from old.nota_admin
       or new.resuelto_por is distinct from old.resuelto_por
       or new.resuelto_en is distinct from old.resuelto_en then
      raise exception 'al re-solicitar solo se puede cambiar el estado';
    end if;
    return new;
  end if;

  -- Caso 2: configurar costo mientras esta aprobada.
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
```

Las transiciones de admin (`aprobada`, `rechazada`, `suspendida`,
`revocada`) pasan exclusivamente por `createAdminClient()` en Server
Actions gateadas por `esAdmin()` — el trigger las deja pasar sin
restricción porque corren con `service_role`.

## 7. Panel de vendedora (`/viandera/perfil`)

Se extiende `FormularioPerfil.tsx` (hoy no expone
retiro/envío/barrio/costo/cobertura — se confirmó leyendo el componente
actual) con:

- Toggle "Ofrezco retiro" (`ofrece_retiro`).
- Toggle "Ofrezco envío propio" (`ofrece_envio`) → si está activo, muestra
  costo (`costo_envio_propio`, con opción explícita "sin tarifa cargada
  todavía" = `null`, que la UI aclara que deja la modalidad no disponible
  para comprar hasta que se cargue un número) y cobertura
  (`cobertura_envio`, texto libre).
- Sección aparte "Envío mediante Puni": muestra el estado actual
  (`sin_solicitar` | `pendiente` | `aprobada` | `rechazada` |
  `suspendida` | `revocada`), con texto claro de qué implica cada uno, un
  botón "Solicitar adhesión" cuando corresponde. **Solo si `aprobada`**:
  un campo editable "Costo de envío mediante Puni" — la vendedora lo
  carga y actualiza ella misma (no es de solo lectura), con la misma
  advertencia de "sin tarifa cargada, esta modalidad no aparece en el
  carrito de tus compradores".

## 8. Panel de admin (`/admin`)

Nueva sección "Solicitudes de adhesión a Puni": lista de
`puni_adhesiones` con `estado = 'pendiente'` primero, luego el resto.
Acciones por fila: Aprobar, Rechazar (pide `nota_admin` opcional), y
para filas `aprobada`: Suspender / Revocar. **El formulario de aprobación
no pide costo de envío** — el admin solo verifica (fuera de ViandApp,
hablando con Puni) que la vendedora efectivamente contrató el servicio, y
aprueba o rechaza. El costo lo carga la vendedora después, desde su
propio panel (§7).

## 9. Cobertura de TDD requerida

1. `transicionValida(desde, hacia, quien)` — tabla de §4 como función
   pura, un test por cada combinación válida e inválida listada,
   incluyendo que `quien = 'admin'` nunca puede escribir
   `costo_envio_puni` (esa función ni siquiera acepta ese campo como
   parámetro — se prueba por la forma del tipo, no en runtime).
2. `modalidadesDisponibles(viandera, adhesion)` — dado
   `ofrece_retiro`/`ofrece_envio`/`costo_envio_propio`/estado y costo de
   adhesión Puni, qué opciones mostrar. **Casos obligatorios de esta
   revisión**: `ofrece_envio = true` pero `costo_envio_propio = null` →
   `envio_propio` **no** aparece; `estado = 'aprobada'` pero
   `costo_envio_puni = null` → `envio_puni` **no** aparece;
   `costo_envio_propio = 0` (gratis explícito) → `envio_propio` **sí**
   aparece.
3. `costoEnvioVigente(modalidad, viandera, adhesionPuni)` — puede
   devolver `null` (nunca se debe interpretar como `0` en ningún punto
   posterior del flujo — la spec de Carrito y pedidos filtra esto antes
   de llegar a `calcularTotal`).
4. **Imposibilidad de autohabilitar Puni** (test de integración, ver
   plan): un intento de `update` directo (con una sesión autenticada
   como la vendedora, sin pasar por el Server Action de admin) que
   intente `estado = 'aprobada'` debe fallar — tanto si parte de
   `pendiente` como de cualquier otro estado.
5. **Imposibilidad de leer `nota_admin` públicamente** (test de
   integración): una consulta con la anon key (sin autenticación) contra
   `puni_adhesiones` debe devolver cero filas para cualquier `select`,
   incluido uno que pida explícitamente `nota_admin`.
6. **La vendedora puede actualizar `costo_envio_puni` mientras está
   aprobada**, pero no puede tocar `nota_admin`/`resuelto_por` en la
   misma operación (test de integración contra el trigger).

## 10. Fuera de alcance de esta entrega

- Contratación, pago o coordinación operativa con Puni — ocurre fuera de
  ViandApp.
- Zonas de cobertura estructuradas/geocoded.
- Múltiples transportistas — el modelo (`retiro` / `envio_propio` /
  `envio_puni`) está cerrado a estos tres.
- Notificar a la vendedora cuando el admin resuelve su solicitud (se
  entera al volver a `/viandera/perfil`).
- Notificar al admin cuando la vendedora carga/cambia su costo de Puni
  (no hace falta que el admin lo vea — es un acuerdo entre la vendedora
  y sus compradores, el admin ya no participa de esa parte).
