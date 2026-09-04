# Configuración de envíos y adhesión a Puni — Diseño

**Fecha:** 2026-09-04
**Estado:** Propuesto — pendiente de revisión de Codex
**Depende de:** nada técnicamente. Es prerequisito de Carrito y pedidos
(necesita `costo_envio_propio`/`cobertura_envio`/`puni_adhesiones` para
calcular envío) — ver orden recomendado en el reporte final.

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
   pueda autodeclararse adherida.

## 2. Invariante central

> "El vendedor no puede autodeclararse adherido... el administrador de
> ViandApp... es el único que puede aprobar, rechazar, suspender o revocar
> la adhesión."

Esto se refuerza en **dos capas**, no solo en la UI:

- **RLS**: la policy de `update`/`insert` de la vendedora sobre
  `puni_adhesiones` solo permite dejar la fila en `estado = 'pendiente'`.
  Ninguna combinación de requests HTTP directos a Supabase (bypaseando la
  UI) le permite escribir `'aprobada'`.
- **Server Action**: las transiciones a `aprobada`/`rechazada`/
  `suspendida`/`revocada` viven en `app/admin/actions.ts`, gateadas por
  `esAdmin()`, usando `createAdminClient()` — mismo patrón que
  `invitarViandera`.

## 3. Modelo de datos

### Extensión de `vianderas` (envío propio, a nivel de cocina — no de plato)

```sql
alter table public.vianderas
  add column if not exists costo_envio_propio numeric check (costo_envio_propio >= 0),
  add column if not exists cobertura_envio text;
```

- `costo_envio_propio` nullable: `null` significa "envío propio ofrecido
  pero costo a coordinar por WhatsApp", no "gratis". `0` sí significa
  gratis, explícitamente. La UI debe distinguir los dos (un campo vacío ≠
  un campo en `0`).
- `cobertura_envio` es texto libre en esta entrega (ej. "Barrio Fátima y
  alrededores") — no hay geocoding ni polígonos. Consistente con el resto
  del proyecto, que ya usa `vianderas.barrio` como texto libre en vez de
  una tabla de barrios normalizada.
- Ambas columnas son irrelevantes si `ofrece_envio = false` — la UI las
  oculta en ese caso, pero el schema no lo fuerza con un constraint (un
  `check` cruzado entre columnas es frágil ante ediciones parciales; se
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
  crea una nueva. Simplifica el join público (§5) y evita el caso "dos
  filas, ¿cuál es la vigente?".
- `costo_envio_puni` solo tiene sentido una vez `aprobada` — se completa en
  el mismo Server Action que aprueba (el admin lo carga al aprobar, después
  de consultar con Puni el valor real — nunca inventado por ViandApp).
- `resuelto_por` es el email del admin (mismo criterio que `ADMIN_EMAIL`,
  no hay tabla de roles todavía) — texto, no FK a `auth.users`, porque hoy
  no hace falta más que un registro de auditoría legible.
- `nota_admin`: texto interno (ej. motivo de un rechazo) — **nunca
  público**, no aparece en ninguna vista/policy de lectura pública (ver
  §5).

## 4. Transiciones de estado válidas

| Desde | Hacia | Quién |
|---|---|---|
| (sin fila) | `pendiente` | Vendedora, al solicitar |
| `pendiente` | `aprobada` / `rechazada` | Admin |
| `aprobada` | `suspendida` / `revocada` | Admin |
| `suspendida` | `aprobada` / `revocada` | Admin |
| `rechazada` | `pendiente` | Vendedora, al re-solicitar |
| `revocada` | `pendiente` | Vendedora, al re-solicitar |

Cualquier otra transición (ej. `pendiente` → `suspendida` directo, o la
vendedora intentando `aprobada` → cualquier cosa) se rechaza — en el
Server Action con un `switch` explícito de transiciones válidas, y en RLS
como red de seguridad para el camino de la vendedora (ver §6).

## 5. Qué se muestra públicamente

Solo cuando `estado = 'aprobada'`:

1. Insignia pública "Adherido a Puni" en `/{slug}` y en las tarjetas de
   `/explorar`.
2. La opción "Envío mediante Puni" aparece en el carrito (spec de Carrito
   y pedidos) — con `costo_envio_puni` como costo mostrado.

Nada de `puni_adhesiones` se expone directo — una vista mínima:

```sql
create view public.puni_adhesion_publica
with (security_invoker = true) as
select viandera_id, costo_envio_puni
from public.puni_adhesiones
where estado = 'aprobada';
```

Dos columnas, cero texto interno (`nota_admin`, `estado` real,
`resuelto_por`, timestamps de auditoría quedan fuera). `security_invoker =
true` para que la vista respete RLS de quien consulta en vez de correr con
privilegios del dueño de la vista (defensa en profundidad — aunque el
`where` ya filtra, no depender de eso como única barrera).

## 6. Acceso y RLS

```sql
alter table public.puni_adhesiones enable row level security;

-- Vendedora ve su propia fila (con nota_admin y todo — es su propia
-- solicitud, tiene derecho a ver por qué la rechazaron).
create policy "viandera ve su propia adhesion"
  on public.puni_adhesiones for select
  using (viandera_id in (select id from public.vianderas where user_id = auth.uid()));

-- Vendedora solicita por primera vez: solo puede insertar en 'pendiente'.
create policy "viandera solicita adhesion"
  on public.puni_adhesiones for insert
  with check (
    viandera_id in (select id from public.vianderas where user_id = auth.uid())
    and estado = 'pendiente'
    and costo_envio_puni is null
    and resuelto_por is null
  );

-- Vendedora re-solicita después de un rechazo/revocación: solo puede
-- mover su propia fila de rechazada/revocada a pendiente, sin tocar nada
-- más (el using/with check comparando old/new vía una función auxiliar
-- es más simple como trigger explícito — ver abajo).
create policy "viandera re-solicita adhesion"
  on public.puni_adhesiones for update
  using (
    viandera_id in (select id from public.vianderas where user_id = auth.uid())
    and estado in ('rechazada', 'revocada')
  )
  with check (estado = 'pendiente');

-- Público (incluido anon) ve solo filas aprobadas, para que la vista
-- security_invoker funcione correctamente.
create policy "cualquiera ve adhesiones aprobadas"
  on public.puni_adhesiones for select
  to anon, authenticated
  using (estado = 'aprobada');
```

Un trigger `puni_adhesiones_bloquear_campos_no_admin()` refuerza que la
policy de "re-solicitar" no deje colar un cambio a `costo_envio_puni`,
`nota_admin` o `resuelto_por` en la misma transacción (Postgres RLS
`with check` no puede comparar fácilmente "todos los demás campos quedan
iguales" sin repetir cada columna) — el trigger rechaza el `update` si
cualquier sesión sin service role intenta cambiar algo más que `estado`
(y de `rechazada`/`revocada` a `pendiente` únicamente).

Las transiciones de admin (`aprobada`, `rechazada`, `suspendida`,
`revocada`) **no tienen policy de RLS para la vendedora** — pasan
exclusivamente por `createAdminClient()` en Server Actions gateadas por
`esAdmin()`, igual que el resto del panel `/admin`.

## 7. Panel de vendedora (`/viandera/perfil`)

Se extiende `FormularioPerfil.tsx` (hoy no expone
retiro/envío/barrio/costo/cobertura — se confirmó leyendo el componente
actual) con:

- Toggle "Ofrezco retiro" (`ofrece_retiro`).
- Toggle "Ofrezco envío propio" (`ofrece_envio`) → si está activo, muestra
  costo (`costo_envio_propio`, con opción explícita "a coordinar" = null)
  y cobertura (`cobertura_envio`, texto libre).
- Sección aparte "Envío mediante Puni": muestra el estado actual
  (`sin_solicitar` | `pendiente` | `aprobada` | `rechazada` |
  `suspendida` | `revocada`), con texto claro de qué implica cada uno, un
  botón "Solicitar adhesión" cuando corresponde, y — solo si `aprobada` —
  el costo que fijó el admin (de solo lectura, la vendedora no lo edita:
  lo acordó con Puni fuera de ViandApp, el admin lo carga).

## 8. Panel de admin (`/admin`)

Nueva sección "Solicitudes de adhesión a Puni": lista de
`puni_adhesiones` con `estado = 'pendiente'` primero, luego el resto.
Acciones por fila: Aprobar (pide cargar `costo_envio_puni`), Rechazar
(pide `nota_admin` opcional), y para filas `aprobada`: Suspender /
Revocar.

## 9. Cobertura de TDD requerida

1. `transicionValida(desde, hacia, quien)` — tabla de §4 como función
   pura, un test por cada combinación válida e inválida listada.
2. `modalidadesDisponibles(viandera)` — dado `ofrece_retiro`/
   `ofrece_envio`/estado de adhesión Puni, qué opciones mostrar (esta
   función es compartida/reexportada por la spec de Carrito y pedidos —
   una sola implementación, no dos).
3. `costoEnvioVigente(modalidad, viandera, adhesionPuni)` — dado qué
   modalidad se eligió, qué costo corresponde (propio, Puni, o `0`/`null`
   para retiro).

## 10. Fuera de alcance de esta entrega

- Contratación, pago o coordinación operativa con Puni — ocurre fuera de
  ViandApp, tal como lo especificó el usuario.
- Zonas de cobertura estructuradas/geocoded (texto libre alcanza para el
  volumen actual).
- Múltiples transportistas — el modelo (`retiro` / `envio_propio` /
  `envio_puni`) está cerrado a estos tres; agregar un cuarto operador
  requeriría revisar el `check` de `modalidad` en `pedidos` (spec de
  Carrito y pedidos) y esta tabla, no es una extensión trivial hoy.
- Notificar a la vendedora cuando el admin resuelve su solicitud (se
  entera al volver a `/viandera/perfil` — un canal de notificación es una
  mejora posterior).
