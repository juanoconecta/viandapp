# Carrito y pedidos por WhatsApp — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL: usar
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans`. Los pasos usan sintaxis de checkbox.

**Revisión correctiva 2026-09-04** sobre el commit `4196de3` (ver reporte
de esa revisión): pedido atómico vía función de Postgres (Task 1, Task 3),
limitador de abuso (Task 1, Task 3 nueva sub-tarea), `idempotency_key` en
`sessionStorage` con verificación de contenido (Task 5), costo `null`
deshabilita la modalidad — nunca se convierte en `0`/"a coordinar" (Task 2,
Task 3), transiciones de `pedidos.estado` validadas por trigger + Server
Action (Task 1, Task 6), retención automática vía Vercel Cron (Task 7),
cobertura de TDD ampliada (Task 8, nueva). Se introduce por primera vez en
este proyecto una capa de **tests de integración contra Postgres real**
(ver Task 0) — hasta ahora todos los tests del repo son funciones puras
sin I/O.

**Objetivo:** carrito de una sola cocina (client-side), confirmación con
revalidación server-side de precio/disponibilidad, pedido creado
atómicamente con captura inmutable, generación de mensaje de WhatsApp, sin
pagos online.

**Arquitectura:** `localStorage` para el carrito pre-confirmación (sin
tabla en la base). Una función transaccional de Postgres
(`crear_pedido_atomico`) crea `pedidos`+`pedido_items` en una sola
transacción, invocable únicamente por `service_role`. Un limitador de
abuso (tabla de contadores por ventana) antes de cualquier escritura.
`idempotency_key` persistida en `sessionStorage` hasta completar o cambiar
el carrito.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS + PL/pgSQL, Vitest (unitarios) + Vitest contra Postgres local
(integración), Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-04-carrito-pedidos-whatsapp-design.md`

**Requiere PRIMERO:**
1. Plan de Envíos/Adhesión a Puni implementado y su migración aplicada
   (esta entrega usa `vianderas.costo_envio_propio`, `cobertura_envio`, y
   la consulta server-only de adhesiones aprobadas de esa spec §5, y
   reexporta `lib/envios/modalidades.ts`).
2. Preflight de backup de Supabase.
3. Decidir y documentar en el repo el mecanismo de tests de integración
   (Task 0) — es infraestructura nueva del proyecto, no algo que se
   pueda improvisar tarea a tarea.

## Global Constraints

- No tocar Supabase hasta revisión de Codex.
- El carrito nunca persiste server-side antes de la confirmación.
- El servidor jamás confía en un precio, disponibilidad, costo de envío o
  total que venga del cliente — todo se revalida contra la base.
- `pedidos`/`pedido_items` se escriben **exclusivamente** dentro de
  `crear_pedido_atomico`, con `EXECUTE` revocado a `public`/`anon`/
  `authenticated` y otorgado solo a `service_role`. Ninguna Server Action
  hace un `insert` directo a estas tablas.
- Una modalidad de envío con costo `null` **nunca** aparece como opción
  seleccionable — no se convierte en `0` ni en "a coordinar" dentro de un
  pedido. Esto se filtra en `modalidadesDisponibles` (plan de
  Envíos/Puni) y se revalida de nuevo server-side antes de crear el
  pedido.
- La vendedora nunca tiene un `UPDATE` sin restricciones sobre `pedidos`
  — todo cambio de `estado` pasa por una tabla de transiciones válidas,
  aplicada por trigger y por Server Action.
- El consentimiento de marketing (`acepta_marketing`) es un campo
  independiente, destildado por defecto.
- `idempotency_key` vive en `sessionStorage`, sobrevive a un refresh de
  la pantalla de checkout, y se regenera si el carrito cambia
  materialmente antes de confirmar.
- El limitador de abuso corre **antes** de cualquier consulta de
  revalidación — un intento por encima del límite nunca llega a tocar
  `viandas` ni `pedidos`.
- Sin nuevas dependencias de **npm**. El uso de Postgres local para tests
  de integración (Task 0) es una herramienta de desarrollo (Supabase
  CLI), no un paquete de `package.json` — se documenta igual como una
  adición real al proyecto, no se minimiza.
- Reutilizar `telefonoParaWhatsapp` (`lib/viandera/telefono.ts`).
- Todas las funciones puras de negocio llevan TDD: test que falla
  primero. Las garantías que no son expresables como función pura
  (atomicidad, límites de tasa, RLS) llevan test de integración (Task 0).

---

### Task 0: Infraestructura de tests de integración

Ningún test existente en el repo toca una base de datos real — todos son
funciones puras. La atomicidad de `crear_pedido_atomico`, el limitador de
abuso, las transiciones validadas por trigger, y la inaccesibilidad
pública de `nota_admin` (spec de Envíos/Puni) **no se pueden verificar
honestamente con un mock** — un mock de Supabase solo prueba que el
código llamó a la función correcta, no que Postgres de verdad hizo
rollback o bloqueó una columna.

**Decisión de este plan:** usar `supabase start` (Supabase CLI, contenedor
Docker local con Postgres real) como target de tests de integración.
Vitest se conecta a esa instancia con `@supabase/supabase-js` (ya es
dependencia) apuntando a las credenciales locales que imprime `supabase
start`. Las migraciones de este plan y de Envíos/Puni se aplican ahí antes
de correr los tests.

**Files:**
- Create: `vitest.integration.config.ts` (config separada, no corre en el
  `npm test` normal — evita que CI/desarrollo cotidiano dependa de tener
  Docker corriendo)
- Create: `package.json` — nuevo script `test:integration` (Vitest con la
  config de arriba)
- Create: `lib/testing/clienteIntegracion.ts` (helper: crea un
  `createClient`/`createAdminClient` apuntando a la instancia local)
- Create: `docs/testing-integracion.md` (cómo levantar `supabase start`,
  aplicar migraciones, correr `npm run test:integration`)

- [ ] **Paso 1: Confirmar con el usuario** que instalar Supabase CLI
  (herramienta de desarrollo, no dependencia de npm) y tener Docker
  disponible localmente es aceptable — es infraestructura nueva para el
  proyecto, no algo que este plan pueda asumir en silencio.

- [ ] **Paso 2: Documentar el procedimiento** en
  `docs/testing-integracion.md`: instalar CLI, `supabase start`, aplicar
  migraciones de este plan y de Envíos/Puni contra la instancia local,
  variables de entorno que necesita `test:integration` (URL y llaves
  locales, nunca las de producción).

- [ ] **Paso 3: Commit**

```bash
git add vitest.integration.config.ts package.json lib/testing/clienteIntegracion.ts docs/testing-integracion.md
git commit -m "chore: add local Postgres integration test infrastructure"
```

---

### Task 1: Migración — `pedidos`, `pedido_items`, función atómica, limitador de abuso

**Files:**
- Create: `supabase/migrations/202609040002_carrito_pedidos.sql`
- Modify: `types/index.ts` (agregar `Pedido`, `PedidoItem`, entradas en
  `Database.public.Tables`)

- [ ] **Paso 1: Escribir la migración**

```sql
-- Pedidos por WhatsApp: creación atómica, idempotencia con verificación
-- de contenido, limitador de abuso, transiciones de estado validadas,
-- retención mínima de datos del comprador.
-- Aditiva, repetible, transaccional.

begin;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  vianderas_id uuid not null references public.vianderas(id) on delete restrict,
  modalidad text not null check (modalidad in ('retiro', 'envio_propio', 'envio_puni')),
  costo_envio_capturado numeric not null default 0 check (costo_envio_capturado >= 0),
  total numeric not null check (total >= 0),
  estado text not null default 'generado'
    check (estado in ('generado', 'confirmado', 'rechazado', 'cancelado')),
  nombre_comprador text,
  telefono_comprador text,
  direccion_envio text,
  acepta_marketing boolean not null default false,
  consentimiento_marketing_en timestamptz,
  purgar_datos_en timestamptz not null default (now() + interval '90 days'),
  datos_purgados boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedidos_marketing_consistente check (
    (acepta_marketing = false and consentimiento_marketing_en is null)
    or (acepta_marketing = true and consentimiento_marketing_en is not null)
  )
);

create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  vianda_id uuid references public.viandas(id) on delete set null,
  nombre_capturado text not null,
  precio_capturado numeric not null check (precio_capturado >= 0),
  cantidad integer not null check (cantidad > 0),
  subtotal numeric generated always as (precio_capturado * cantidad) stored
);

alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;

drop trigger if exists pedidos_set_updated_at on public.pedidos;
create trigger pedidos_set_updated_at
before update on public.pedidos
for each row execute function public.viandapp_set_updated_at();

-- Transiciones válidas de pedidos.estado para sesiones sin service role
-- (spec §11): generado->confirmado, generado->rechazado. Nada más.
-- También bloquea cualquier cambio a las columnas de contenido/montos.
create or replace function public.pedidos_validar_transicion()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.total is distinct from old.total
     or new.costo_envio_capturado is distinct from old.costo_envio_capturado
     or new.nombre_comprador is distinct from old.nombre_comprador
     or new.telefono_comprador is distinct from old.telefono_comprador
     or new.direccion_envio is distinct from old.direccion_envio
     or new.vianderas_id is distinct from old.vianderas_id
     or new.modalidad is distinct from old.modalidad
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'solo se puede modificar el estado del pedido';
  end if;

  if not (
    (old.estado = 'generado' and new.estado in ('confirmado', 'rechazado'))
    or (old.estado = new.estado)
  ) then
    raise exception 'transicion de estado no permitida: % -> %', old.estado, new.estado;
  end if;

  return new;
end;
$$;

drop trigger if exists pedidos_validar_transicion_trigger on public.pedidos;
create trigger pedidos_validar_transicion_trigger
before update on public.pedidos
for each row execute function public.pedidos_validar_transicion();

create policy "viandera ve sus propios pedidos"
  on public.pedidos for select
  using (vianderas_id in (select id from public.vianderas where user_id = auth.uid()));

create policy "viandera actualiza estado de sus propios pedidos"
  on public.pedidos for update
  using (vianderas_id in (select id from public.vianderas where user_id = auth.uid()));

create policy "viandera ve items de sus propios pedidos"
  on public.pedido_items for select
  using (
    pedido_id in (
      select id from public.pedidos
      where vianderas_id in (select id from public.vianderas where user_id = auth.uid())
    )
  );

-- Sin policy de insert en absoluto para pedidos/pedido_items: el único
-- camino de escritura es crear_pedido_atomico, invocable solo por
-- service_role (revoke/grant más abajo).

create or replace function public.crear_pedido_atomico(
  p_idempotency_key uuid,
  p_vianderas_id uuid,
  p_modalidad text,
  p_costo_envio_capturado numeric,
  p_total numeric,
  p_nombre_comprador text,
  p_telefono_comprador text,
  p_direccion_envio text,
  p_acepta_marketing boolean,
  p_items jsonb
) returns public.pedidos
language plpgsql
as $$
declare
  v_pedido public.pedidos;
  v_items_hash text;
  v_existing_hash text;
begin
  select id into v_pedido from public.pedidos where idempotency_key = p_idempotency_key;

  if found then
    select md5(coalesce(jsonb_agg(
             jsonb_build_object(
               'vianda_id', vianda_id,
               'nombre_capturado', nombre_capturado,
               'precio_capturado', precio_capturado,
               'cantidad', cantidad
             ) order by id
           ), '[]'::jsonb)::text)
      into v_existing_hash
      from public.pedido_items
      where pedido_id = v_pedido.id;

    v_items_hash := md5(p_items::text);

    if v_existing_hash is distinct from v_items_hash
       or v_pedido.vianderas_id is distinct from p_vianderas_id
       or v_pedido.modalidad is distinct from p_modalidad
       or v_pedido.total is distinct from p_total then
      raise exception 'idempotency_key_content_mismatch'
        using errcode = 'P0001',
              hint = 'La misma idempotency_key se reutilizó con contenido distinto.';
    end if;

    select * into v_pedido from public.pedidos where id = v_pedido.id;
    return v_pedido;
  end if;

  insert into public.pedidos (
    idempotency_key, vianderas_id, modalidad, costo_envio_capturado, total,
    nombre_comprador, telefono_comprador, direccion_envio,
    acepta_marketing, consentimiento_marketing_en
  ) values (
    p_idempotency_key, p_vianderas_id, p_modalidad, p_costo_envio_capturado, p_total,
    p_nombre_comprador, p_telefono_comprador, p_direccion_envio,
    p_acepta_marketing, case when p_acepta_marketing then now() else null end
  ) returning * into v_pedido;

  insert into public.pedido_items (pedido_id, vianda_id, nombre_capturado, precio_capturado, cantidad)
  select
    v_pedido.id,
    (item->>'vianda_id')::uuid,
    item->>'nombre_capturado',
    (item->>'precio_capturado')::numeric,
    (item->>'cantidad')::integer
  from jsonb_array_elements(p_items) as item;

  return v_pedido;
end;
$$;

revoke all on function public.crear_pedido_atomico from public;
revoke all on function public.crear_pedido_atomico from anon;
revoke all on function public.crear_pedido_atomico from authenticated;
grant execute on function public.crear_pedido_atomico to service_role;

-- Limitador de abuso: contador de ventana fija por clave. La clave nunca
-- es una IP en texto plano — ver Task 3 para el hasheo antes de llegar
-- acá.
create table if not exists public.limite_solicitudes (
  clave text not null,
  ventana_inicio timestamptz not null,
  intentos integer not null default 1,
  primary key (clave, ventana_inicio)
);

alter table public.limite_solicitudes enable row level security;
-- Sin policies: 100% acceso vía service_role.

create or replace function public.registrar_intento_limite(
  p_clave text,
  p_ventana_inicio timestamptz
) returns integer
language sql
as $$
  insert into public.limite_solicitudes (clave, ventana_inicio, intentos)
  values (p_clave, p_ventana_inicio, 1)
  on conflict (clave, ventana_inicio)
  do update set intentos = public.limite_solicitudes.intentos + 1
  returning intentos;
$$;

revoke all on function public.registrar_intento_limite from public;
revoke all on function public.registrar_intento_limite from anon;
revoke all on function public.registrar_intento_limite from authenticated;
grant execute on function public.registrar_intento_limite to service_role;

commit;
```

- [ ] **Paso 2: Actualizar `types/index.ts`** con `Pedido`, `PedidoItem`,
  `ModalidadPedido`, `EstadoPedido`, y sus entradas en `Database`.

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/202609040002_carrito_pedidos.sql types/index.ts
git commit -m "feat: add pedidos migration with atomic order creation and rate limiting"
```

---

### Task 2: Funciones puras de negocio (TDD)

**Files:**
- Create: `lib/pedidos/total.ts`
- Create: `lib/pedidos/total.test.ts`
- Create: `lib/pedidos/revalidacion.ts`
- Create: `lib/pedidos/revalidacion.test.ts`
- Create: `lib/pedidos/mensaje.ts`
- Create: `lib/pedidos/mensaje.test.ts`
- Create: `lib/pedidos/limiteAbuso.ts`
- Create: `lib/pedidos/limiteAbuso.test.ts`

**Interfaces:**
- Consume: `Modalidad`, `modalidadesDisponibles`, `costoEnvioVigente` de
  `lib/envios/modalidades.ts` (plan de Envíos/Puni) — no se reimplementa
  acá; esas funciones ya excluyen modalidades con costo `null`.
- Produce: `calcularTotal`, `validarUnaSolaCocina`, `detectarCambios`,
  `construirMensajePedido`, `claveLimite`, `debeLimitar` — consumidos por
  el Server Action (Task 3).

- [ ] **Paso 1-6**: idénticos a la versión anterior de este plan para
  `calcularTotal`, `validarUnaSolaCocina` y `detectarCambios` — sin
  cambios de esta revisión, se mantienen los tests y la implementación ya
  escritos.

```ts
// lib/pedidos/total.ts
export type ItemParaTotal = { precioCapturado: number; cantidad: number };

export function calcularTotal(items: ItemParaTotal[], costoEnvio: number): number {
  if (items.length === 0) {
    throw new Error("No se puede calcular el total de un carrito vacío.");
  }
  for (const item of items) {
    if (item.precioCapturado < 0 || item.cantidad <= 0) {
      throw new Error("Precio o cantidad inválidos.");
    }
  }
  const subtotalItems = items.reduce(
    (acc, item) => acc + item.precioCapturado * item.cantidad,
    0,
  );
  return subtotalItems + costoEnvio;
}

export function validarUnaSolaCocina(items: { vianderaId: string }[]): boolean {
  const distintas = new Set(items.map((i) => i.vianderaId));
  return distintas.size <= 1;
}
```

Tests: los mismos 5 casos ya definidos (suma exacta, envío en cero,
lista vacía lanza, precio/cantidad inválidos lanza, decimales exactos) +
**dos nuevos casos obligatorios de esta revisión**:

```ts
  it("costo de envio null nunca llega a calcularTotal: se rechaza si alguien lo intenta pasar", () => {
    // calcularTotal recibe number, no number|null — este test documenta
    // que el filtrado pasa ANTES, en modalidadesDisponibles/costoEnvioVigente
    // (plan de Envíos/Puni), no acá. calcularTotal(items, null as any)
    // debe lanzar en tiempo de ejecución si algo se saltea ese filtro.
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: 1 }], null as never)).toThrow();
  });

  it("costo de envio 0 configurado explicitamente es valido", () => {
    expect(calcularTotal([{ precioCapturado: 100, cantidad: 1 }], 0)).toBe(100);
  });
```

`detectarCambios` (Paso 4-6 de la versión anterior): sin cambios.

- [ ] **Paso 7: Test de `construirMensajePedido`** — igual al de la
  versión anterior de este plan, sin cambios de contenido.

- [ ] **Paso 8: Implementación mínima** — sin cambios.

- [ ] **Paso 9: Correr tests, confirmar que pasan.**

- [ ] **Paso 10: Test de `claveLimite`/`debeLimitar` (falla primero)**

```ts
// lib/pedidos/limiteAbuso.test.ts
import { describe, expect, it } from "vitest";
import { debeLimitar, ventanaActual } from "./limiteAbuso";

describe("debeLimitar", () => {
  it("false si los intentos estan por debajo del limite", () => {
    expect(debeLimitar(3, 5)).toBe(false);
  });

  it("true si los intentos alcanzan o superan el limite", () => {
    expect(debeLimitar(5, 5)).toBe(true);
    expect(debeLimitar(6, 5)).toBe(true);
  });
});

describe("ventanaActual", () => {
  it("trunca una fecha al inicio de la ventana de N minutos", () => {
    const fecha = new Date("2026-09-04T10:07:32Z");
    expect(ventanaActual(fecha, 5).toISOString()).toBe("2026-09-04T10:05:00.000Z");
  });
});
```

- [ ] **Paso 11: Implementación mínima**

```ts
// lib/pedidos/limiteAbuso.ts
export function debeLimitar(intentos: number, limite: number): boolean {
  return intentos >= limite;
}

export function ventanaActual(ahora: Date, minutosVentana: number): Date {
  const ms = minutosVentana * 60 * 1000;
  return new Date(Math.floor(ahora.getTime() / ms) * ms);
}
```

- [ ] **Paso 12: Correr tests, confirmar que pasan.**

- [ ] **Paso 13: Commit**

```bash
git add lib/pedidos/
git commit -m "feat: add pure order total, revalidation, message, and rate-limit logic with tests"
```

---

### Task 3: Server Action `generarPedido`

**Files:**
- Create: `app/pedido/actions.ts`
- Create: `lib/pedidos/hashIp.ts` (hasheo server-only de IP, nunca
  guardada en texto plano)
- Create: `lib/pedidos/hashIp.test.ts`

**Interfaces:**
- Consume: `calcularTotal`, `validarUnaSolaCocina`, `detectarCambios`,
  `construirMensajePedido`, `debeLimitar`, `ventanaActual` (Task 2);
  `modalidadesDisponibles`, `costoEnvioVigente` (plan de Envíos/Puni);
  `telefonoParaWhatsapp` (existente).
- Produce: tipo de resultado consumido por la UI (Task 5).

- [ ] **Paso 1: `hashIp`**

```ts
// lib/pedidos/hashIp.ts
import "server-only";
import { createHash } from "node:crypto";

export function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt) {
    throw new Error("RATE_LIMIT_SALT no configurado.");
  }
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}
```

Test: mismo IP + mismo salt siempre da el mismo hash; IPs distintas dan
hashes distintos; nunca devuelve la IP original en el string resultante
(assert `!resultado.includes(ip)`). `RATE_LIMIT_SALT` se suma a las
variables de entorno server-only de `CLAUDE.md` en el commit de esta
tarea.

- [ ] **Paso 2: Definir el contrato de entrada/salida**

```ts
export type ItemCarrito = { platoId: string; cantidad: number; precioVisto: number };

export type DatosConfirmacion = {
  vianderaId: string;
  items: ItemCarrito[];
  modalidad: "retiro" | "envio_propio" | "envio_puni";
  nombreComprador: string;
  telefonoComprador: string;
  direccionEnvio: string | null;
  aceptaMarketing: boolean;
  idempotencyKey: string;
  sesionId: string; // token opaco generado por el cliente, ver Task 5
};

export type ResultadoGenerarPedido =
  | { status: "limite_excedido"; mensaje: string }
  | { status: "revisar_carrito"; cambios: CambioDetectado[] }
  | { status: "error"; mensaje: string }
  | { status: "ok"; pedidoId: string; whatsappHref: string };
```

- [ ] **Paso 3: Implementar `generarPedido(datos: DatosConfirmacion)`**

Orden de operaciones (cada una corta el flujo si falla):

1. **Limitador de abuso, primero que nada.** Tres chequeos, cualquiera
   que falle corta el flujo con `status: "limite_excedido"` sin tocar
   `viandas` ni `pedidos`:
   - Global: `registrar_intento_limite('global', ventanaActual(ahora, 5))`,
     límite inicial 100 por ventana de 5 minutos.
   - Por sesión: `registrar_intento_limite('sesion:' + datos.sesionId,
     ventanaActual(ahora, 60))`, límite inicial 5 por hora.
   - Por origen: obtener la IP de la request (headers de Next.js —
     `x-forwarded-for` detrás de Vercel), `hashIp()`,
     `registrar_intento_limite('ip:' + hash, ventanaActual(ahora, 60))`,
     límite inicial 10 por hora (más laxo que por sesión, porque varias
     personas legítimas pueden compartir una IP — ej. una casa, un
     comercio con wifi compartido).
2. Validar campos obligatorios presentes (nombre, teléfono, dirección si
   `modalidad !== 'retiro'`).
3. `validarUnaSolaCocina` sobre los items recibidos.
4. Consultar `viandas` actuales para los `platoId` recibidos, filtrando
   por `vianderas_id` en la misma query.
5. `detectarCambios` entre lo que el cliente ve y lo que el servidor
   acaba de leer. Si no está vacío → `revisar_carrito`, sin escribir
   nada.
6. Consultar la config de envío vigente de la viandera (spec de
   Envíos/Puni §5, consulta server-only) y llamar
   `modalidadesDisponibles`/`costoEnvioVigente`. **Si la modalidad
   pedida ya no está en el resultado de `modalidadesDisponibles` (porque
   su costo es `null`, o porque la adhesión Puni cambió de estado entre
   que se abrió el carrito y se confirmó) → error explícito, nunca se
   sigue con un costo inventado.**
7. `calcularTotal` con los precios recién leídos del servidor + el costo
   de envío del paso 6 (garantizado no-`null` en este punto).
8. Verificar teléfono de la vendedora vía `telefonoParaWhatsapp`.
9. Armar el `jsonb` de ítems y llamar
   `admin.rpc('crear_pedido_atomico', {...})`. Si la función lanza
   `idempotency_key_content_mismatch` → `status: "error"` con un mensaje
   que le pida al usuario recargar el carrito desde cero (caso raro:
   `idempotencyKey` reutilizada con contenido distinto, no debería pasar
   si el cliente regenera la key al cambiar el carrito — ver Task 5).
10. `construirMensajePedido` con los datos capturados, armar el
    `whatsappHref`.
11. Devolver `{ status: "ok", pedidoId, whatsappHref }`.

- [ ] **Paso 4: Tests unitarios** (mock de Supabase admin client) para:
  límite excedido en cualquiera de las tres capas corta antes de
  cualquier consulta a `viandas` (spy que falla el test si se llama);
  cambio de precio detectado devuelve `revisar_carrito` sin llamar
  `crear_pedido_atomico`; ítems de dos cocinas distintas rechazados antes
  de cualquier consulta; una modalidad con costo `null` nunca llega a
  `calcularTotal` (mock de `costoEnvioVigente` devolviendo `null`,
  confirmar `status: "error"`).

- [ ] **Paso 5: Tests de integración** (Task 0, contra Postgres local):
  - Dos llamadas con el mismo `idempotencyKey` y el mismo contenido
    devuelven el mismo `pedidoId`, y `pedido_items` tiene exactamente la
    cantidad de filas esperada (no el doble).
  - La misma `idempotencyKey` con contenido distinto (ej. otro total)
    lanza `idempotency_key_content_mismatch`.
  - Forzar un fallo a mitad de la función (ej. un `vianda_id` que viola
    una FK) y confirmar que **no queda ninguna fila en `pedidos`** —
    la transacción completa hizo rollback.
  - El limitador de abuso: superar el límite de una clave y confirmar
    que la siguiente llamada a `registrar_intento_limite` para esa clave
    en la misma ventana sigue incrementando (no se resetea solo), y que
    una clave distinta no se ve afectada.

- [ ] **Paso 6: Commit**

```bash
git add app/pedido/actions.ts app/pedido/actions.test.ts lib/pedidos/hashIp.ts lib/pedidos/hashIp.test.ts
git commit -m "feat: add generarPedido server action with rate limiting and atomic order creation"
```

---

### Task 4: Carrito en `localStorage` + UI

Sin cambios respecto a la versión anterior de este plan — carrito de
cliente, `CarritoProvider`, `BotonAgregarAlCarrito`, `CajonCarrito`. Ver
detalle de pasos en la spec §3.

**Files:**
- Create: `lib/carrito/almacenamiento.ts`, `lib/carrito/almacenamiento.test.ts`
- Create: `components/carrito/CarritoProvider.tsx`
- Create: `components/carrito/BotonAgregarAlCarrito.tsx`
- Create: `components/carrito/CajonCarrito.tsx`
- Modify: `components/storefront/PublicDishCard.tsx`,
  `components/consumer/DishCard.tsx`

- [ ] **Pasos 1-6**: implementación de almacenamiento, provider, botón,
  cajón, responsive — sin cambios de esta revisión.

- [ ] **Paso 7: Commit**

```bash
git add lib/carrito/ components/carrito/ components/storefront/PublicDishCard.tsx components/consumer/DishCard.tsx
git commit -m "feat: add client-side single-vendor cart"
```

---

### Task 5: Pantalla de confirmación y resultado

**Files:**
- Create: `components/carrito/ConfirmarPedido.tsx`
- Create: `components/carrito/RevisarCambios.tsx`
- Create: `lib/carrito/sesionCheckout.ts` (maneja `idempotencyKey` +
  `sesionId` en `sessionStorage`)
- Create: `lib/carrito/sesionCheckout.test.ts`

**Interfaces:**
- Consume: `generarPedido` (Task 3), `modalidadesDisponibles` (plan de
  Envíos/Puni).

- [ ] **Paso 1: `sesionCheckout.ts`** — maneja dos valores en
  `sessionStorage` (clave `viandapp:checkout`):

```ts
type SesionCheckout = {
  idempotencyKey: string;
  sesionId: string;
  huellaCarrito: string; // hash simple del contenido del carrito al generar la key
};
```

  - `obtenerOCrearSesion(huellaCarritoActual)`: si no hay sesión guardada,
    o la `huellaCarrito` guardada no coincide con la actual (el carrito
    cambió desde que se generó la key), genera una nueva
    `idempotencyKey` (y `sesionId` si tampoco existía) y la persiste. Si
    coincide, devuelve la existente — sobrevive a un refresh de la
    pantalla.
  - `limpiarSesion()`: se llama al completar el pedido con éxito.
  - Test: huella distinta regenera la key; huella igual la conserva;
    `sesionId` persiste incluso cuando la key se regenera (identifica la
    sesión de navegación, no el contenido puntual del carrito).

- [ ] **Paso 2: `ConfirmarPedido`** — usa `obtenerOCrearSesion` (no
  `crypto.randomUUID()` suelto como en la versión anterior de este plan),
  muestra solo las modalidades que `modalidadesDisponibles` habilita
  (nunca una con costo `null`), checkbox de marketing destildado por
  defecto.

- [ ] **Paso 3: Manejo de `revisar_carrito`** — igual a la versión
  anterior: `RevisarCambios` lista los cambios, botón "Volver al
  carrito" actualiza el carrito a los valores nuevos.

- [ ] **Paso 4: Manejo de `limite_excedido`** — mensaje genérico ("Hubo
  muchos intentos, probá de nuevo en un rato"), sin detalle de qué capa
  del límite se excedió.

- [ ] **Paso 5: Resultado `ok`** — vacía el carrito y llama
  `limpiarSesion()`, muestra el link de WhatsApp con el texto explícito
  de que abrir WhatsApp no confirma el pedido.

- [ ] **Paso 6: Commit**

```bash
git add components/carrito/ConfirmarPedido.tsx components/carrito/RevisarCambios.tsx lib/carrito/sesionCheckout.ts lib/carrito/sesionCheckout.test.ts
git commit -m "feat: add order confirmation flow with durable idempotency and rate-limit handling"
```

---

### Task 6: Panel de pedidos en `/viandera`

**Files:**
- Create: `app/viandera/pedidos/page.tsx`
- Create: `components/viandera/TarjetaPedido.tsx`
- Modify: `app/viandera/actions.ts` (agregar `actualizarEstadoPedido`)

**Interfaces:**
- Consume: RLS + trigger de transición de `pedidos` (Task 1).

- [ ] **Paso 1: Listado** — pedidos ordenados por `created_at desc`,
  estado, ítems, total, modalidad.

- [ ] **Paso 2: `actualizarEstadoPedido`** — Server Action que autentica
  que el pedido pertenece a la vendedora, valida la transición contra la
  tabla de la spec §11 (`generado`→`confirmado`/`rechazado` únicamente)
  **antes** de escribir — el trigger de la Task 1 es la red de
  seguridad, no el único control; un error de transición debe dar un
  mensaje claro en la UI, no un error crudo de Postgres.

- [ ] **Paso 3: Test** — intento de transición inválida
  (`confirmado`→`generado`) devuelve error sin llegar a hacer `update`
  (mock que falla si se invoca).

- [ ] **Paso 4: Commit**

```bash
git add app/viandera/pedidos/ components/viandera/TarjetaPedido.tsx app/viandera/actions.ts
git commit -m "feat: add order list and validated status transitions in seller panel"
```

---

### Task 7: Purgado automático de datos del comprador

**Files:**
- Create: `lib/pedidos/purgado.ts`
- Create: `lib/pedidos/purgado.test.ts`
- Create: `app/api/cron/purgar-pedidos/route.ts`
- Modify: `vercel.json` (crear si no existe) — agregar el cron
- Modify: `app/admin/actions.ts` — agregar `purgarPedidosVencidos` como
  gatillo manual de respaldo

- [ ] **Paso 1: Test y función pura** — `debePurgar(pedido, ahora)` es
  `true` si `ahora >= purgar_datos_en` y `datos_purgados === false`.
  Test adicional: `aplicarPurgado(pedido)` devuelve el pedido con
  `nombre_comprador`/`telefono_comprador`/`direccion_envio` en `null` y
  `datos_purgados: true`, **sin tocar** `total`, `costo_envio_capturado`,
  ni ningún campo de `pedido_items` (la función ni siquiera acepta esos
  campos como entrada — no puede tocarlos por construcción del tipo).

```ts
// lib/pedidos/purgado.ts
export type PedidoParaPurgar = {
  id: string;
  purgarDatosEn: string;
  datosPurgados: boolean;
};

export function debePurgar(pedido: PedidoParaPurgar, ahora: Date): boolean {
  return !pedido.datosPurgados && ahora >= new Date(pedido.purgarDatosEn);
}
```

- [ ] **Paso 2: Route Handler del cron**

```ts
// app/api/cron/purgar-pedidos/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { debePurgar } from "@/lib/pedidos/purgado";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const ahora = new Date();

  const { data: candidatos, error } = await admin
    .from("pedidos")
    .select("id, purgar_datos_en, datos_purgados")
    .eq("datos_purgados", false)
    .lte("purgar_datos_en", ahora.toISOString());

  if (error) {
    return NextResponse.json({ error: "Fallo al consultar" }, { status: 500 });
  }

  const idsAPurgar = (candidatos ?? [])
    .filter((p) =>
      debePurgar(
        { id: p.id, purgarDatosEn: p.purgar_datos_en, datosPurgados: p.datos_purgados },
        ahora,
      ),
    )
    .map((p) => p.id);

  if (idsAPurgar.length > 0) {
    await admin
      .from("pedidos")
      .update({
        nombre_comprador: null,
        telefono_comprador: null,
        direccion_envio: null,
        datos_purgados: true,
      })
      .in("id", idsAPurgar);
  }

  return NextResponse.json({ purgados: idsAPurgar.length });
}
```

- [ ] **Paso 3: `vercel.json`**

```json
{
  "crons": [{ "path": "/api/cron/purgar-pedidos", "schedule": "0 6 * * *" }]
}
```

  Corre diario a las 6am UTC. `CRON_SECRET` se suma a las variables de
  entorno server-only de `CLAUDE.md`.

- [ ] **Paso 4: `purgarPedidosVencidos`** en `/admin` — mismo cuerpo que
  el Route Handler, gateado por `esAdmin()`, como gatillo manual
  inmediato (ej. para verificar que el mecanismo funciona sin esperar al
  cron, o como respaldo si el cron falla por algún motivo).

- [ ] **Paso 5: Test de integración** (Task 0): un pedido con
  `purgar_datos_en` en el pasado, después de correr el purgado, tiene
  `nombre_comprador`/`telefono_comprador`/`direccion_envio` en `null` y
  `datos_purgados = true`, pero `total`, `costo_envio_capturado`, y todas
  las filas de `pedido_items` **sin ningún cambio**.

- [ ] **Paso 6: Commit**

```bash
git add lib/pedidos/purgado.ts lib/pedidos/purgado.test.ts app/api/cron/purgar-pedidos/route.ts vercel.json app/admin/actions.ts
git commit -m "feat: add automatic Vercel Cron purge of expired buyer data"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] Ningún camino de `anon`/`authenticated` puede insertar en
  `pedidos`/`pedido_items` — confirmado por `select * from pg_policies
  where tablename in ('pedidos','pedido_items') and cmd = 'INSERT'`
  devolviendo cero filas, **y** por
  `select has_function_privilege('anon', 'crear_pedido_atomico(...)',
  'EXECUTE')` devolviendo `false`.
- [ ] `crear_pedido_atomico` probado con un fallo forzado a mitad de
  camino: cero filas residuales en `pedidos`.
- [ ] `idempotency_key` reutilizada con contenido distinto: rechazada,
  no sobrescribe.
- [ ] El limitador de abuso corre antes de cualquier consulta a
  `viandas`, y ninguna IP se guarda en texto plano
  (`select telefono_comprador... ` no aplica acá — chequear
  específicamente que `limite_solicitudes.clave` nunca contenga un
  patrón de IP sin hashear, ej. con un test que intente insertar una IP
  cruda y confirme que el código de aplicación nunca lo hace).
- [ ] Una modalidad con costo `null` nunca resulta en un `pedidos` creado
  — confirmado por test de integración, no solo por el filtro de la UI.
- [ ] `generarPedido` filtra `viandas` por `vianderas_id` en la misma
  query.
- [ ] El total se recalcula server-side siempre.
- [ ] `acepta_marketing` nunca se setea a `true` sin
  `consentimiento_marketing_en` (constraint de base).
- [ ] El teléfono del comprador nunca aparece en el mensaje de WhatsApp.
- [ ] El cron de purgado corre automáticamente (`vercel.json` desplegado
  y `CRON_SECRET` configurado) — **gate de publicación**: esta entrega
  no está lista para producción hasta confirmar esto con una corrida real
  del cron (o del gatillo manual) contra un pedido de prueba.
- [ ] Ninguna transición de `pedidos.estado` fuera de la tabla de la spec
  §11 es posible ni desde la Server Action ni escribiendo directo a la
  tabla (RLS + trigger probados por separado).

## QA responsive

- [ ] Cajón de carrito: 375–1440px, sin scroll horizontal, controles de
  cantidad ≥44px.
- [ ] Pantalla de confirmación: formulario usable en 375px, checkbox de
  marketing con área táctil clara y separada del botón de confirmar,
  modalidades con costo `null` simplemente no aparecen en la lista (no
  aparecen deshabilitadas con explicación — se recomienda confirmar con
  el usuario en revisión visual si prefiere mostrarlas deshabilitadas
  con un texto tipo "sin tarifa configurada" en vez de ocultarlas del
  todo; la spec no cierra esa decisión de UX, solo el invariante de
  backend).
- [ ] Pantalla de revisión de cambios: legible en mobile.
- [ ] Panel de pedidos en `/viandera`: lista usable en mobile y desktop.

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** Antes de la Task 0, confirmar con el usuario que
instalar Supabase CLI/Docker para tests de integración es aceptable — es
la única forma honesta de probar atomicidad, límites de tasa y RLS, pero
es infraestructura nueva que el usuario no pidió explícitamente y merece
su propio visto bueno. Al terminar, detenerse y reportar resultado de
tests (unitarios e integración) y cualquier desvío.
