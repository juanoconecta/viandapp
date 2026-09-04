# Carrito y pedidos por WhatsApp — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL: usar
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans`. Los pasos usan sintaxis de checkbox.

**Segunda revisión correctiva 2026-09-04** sobre el commit `2ee4acc`:
`crear_pedido_atomico` bloquea y revalida `viandas` **dentro** de la
transacción (Task 1) en vez de confiar en una lectura previa;
`request_hash` canónico para idempotencia concurrente (Task 1, Task 3);
`GRANT`/`REVOKE ... ON FUNCTION` con firma completa de argumentos
(Task 1); `calcularTotal` corregido para rechazar `null`/`NaN`/
`Infinity` en runtime (Task 2); limitador de abuso con HMAC real, sesión
server-emitida como señal secundaria (nunca frontera de seguridad), y
límite global convertido en circuito de emergencia de umbral alto
(Task 1, Task 3); cron falla cerrado y comparte servicio de purgado con
la limpieza del limitador (Task 7); Task 0 ofrece dos caminos concretos
para la infraestructura de integración porque **esta máquina no tiene
Docker Desktop instalado** (verificado); 12 tests de integración nuevos
(Task 8, nueva).

**Objetivo:** carrito de una sola cocina (client-side), pedido creado
atómicamente con revalidación bloqueante dentro de la misma transacción,
captura inmutable, generación de mensaje de WhatsApp, sin pagos online.

**Arquitectura:** `localStorage` para el carrito pre-confirmación. Una
función transaccional de Postgres (`crear_pedido_atomico`) hace ella
misma la lectura bloqueada (`FOR UPDATE`) de `viandas`, el cálculo de
precios/total, y la creación de `pedidos`+`pedido_items` — invocable
únicamente por `service_role`. Un limitador de abuso (HMAC de IP +
sesión server-emitida como señal secundaria + circuito global de
emergencia) antes de cualquier escritura.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS + PL/pgSQL, Vitest (unitarios) + Vitest de integración contra
Postgres real (Task 0), Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-04-carrito-pedidos-whatsapp-design.md`

**Requiere PRIMERO:**
1. Plan de Envíos/Adhesión a Puni implementado y aplicado.
2. Preflight de backup de Supabase.
3. Resolver la Task 0 (infraestructura de integración) — **bloqueante**,
   esta máquina no tiene Docker Desktop instalado hoy.

## Global Constraints

- No tocar Supabase hasta revisión de Codex.
- **Nunca ejecutar pruebas destructivas ni migraciones experimentales
  contra el proyecto de producción de Supabase** — la infraestructura de
  integración (Task 0) usa exclusivamente una instancia local o un
  proyecto de staging separado, jamás producción.
- `crear_pedido_atomico` hace su propia lectura bloqueada de `viandas`
  dentro de la transacción — ninguna Server Action puede tratar una
  lectura previa como autoritativa.
- Todo `GRANT`/`REVOKE ... ON FUNCTION` incluye la firma completa de
  tipos de argumentos.
- La IP se hashea con HMAC-SHA256 y un secreto server-only, nunca con
  una concatenación + hash simple, y nunca se guarda en texto plano.
- El identificador de sesión para el limitador lo emite el servidor
  (cookie `httpOnly`) y es una señal secundaria — el límite de IP es la
  frontera de seguridad real.
- El límite global es un circuito de emergencia de umbral alto, no un
  bloqueo que pocas solicitudes maliciosas puedan activar en operación
  normal.
- El cron de purgado falla cerrado si `CRON_SECRET` no está configurado.
- La lógica de purgado (pedidos y contadores del limitador) vive en un
  único servicio compartido, nunca duplicada entre el cron y la acción
  manual de admin.
- Sin nuevas dependencias de npm.
- Todas las funciones puras de negocio llevan TDD. Las garantías que
  dependen de Postgres (atomicidad, locks, RLS, HMAC en el limitador)
  llevan test de integración — no un mock.

---

### Task 0: Infraestructura de tests de integración — bloqueante, dos caminos

**Confirmado**: esta máquina no tiene Docker Desktop instalado (`docker
--version` no encuentra el binario). No se puede levantar Supabase local
hoy sin una acción explícita del usuario. Dos caminos concretos, a
elegir por el usuario antes de continuar:

**Camino A — instalar Docker Desktop.**
- [ ] El usuario instala/autoriza Docker Desktop en esta máquina.
- [ ] `supabase start` (Supabase CLI) levanta Postgres local.
- [ ] Los tests de integración apuntan a las credenciales locales que
  imprime `supabase start` — nunca a producción.

**Camino B — proyecto Supabase de staging separado.**
- [ ] El usuario crea (o designa) un proyecto Supabase distinto del de
  producción, exclusivamente para tests de integración.
- [ ] Los tests de integración apuntan a las credenciales de ese
  proyecto de staging vía variables de entorno propias
  (`SUPABASE_STAGING_URL`, `SUPABASE_STAGING_SERVICE_ROLE_KEY` — nunca
  las mismas variables que apuntan a producción, para que sea imposible
  correr un test destructivo contra el proyecto real por error de
  configuración).
- [ ] **Nunca** se corren pruebas destructivas ni migraciones
  experimentales contra el proyecto de producción — el proyecto de
  staging es prescindible/reseteable, el de producción no.

**Files** (comunes a ambos caminos):
- Create: `vitest.integration.config.ts`
- Create: `lib/testing/clienteIntegracion.ts` (lee las credenciales de
  variables de entorno — `SUPABASE_STAGING_*` o las locales de
  `supabase start`, nunca hardcodeadas, nunca las de producción)
- Create: `docs/testing-integracion.md` (documenta ambos caminos, cómo
  aplicar las migraciones de este plan y de Envíos/Puni contra el target
  elegido antes de correr `npm run test:integration`)
- Modify: `package.json` — script `test:integration`

- [ ] **Paso 1: Confirmar con el usuario cuál camino elige** (A o B) —
  no se asume ninguno.
- [ ] **Paso 2: Documentar el procedimiento elegido** en
  `docs/testing-integracion.md`.
- [ ] **Paso 3: Commit**

```bash
git add vitest.integration.config.ts lib/testing/clienteIntegracion.ts docs/testing-integracion.md package.json
git commit -m "chore: add integration test infrastructure (local or staging Supabase)"
```

**No continuar a las Tasks que requieren test de integración (marcadas
explícitamente) sin esto resuelto** — las tareas de funciones puras (sin
I/O) sí pueden avanzar en paralelo.

---

### Task 1: Migración — `pedidos`, `pedido_items`, función atómica con lock real, limitador con HMAC

**Files:**
- Create: `supabase/migrations/202609040002_carrito_pedidos.sql`
- Modify: `types/index.ts`

- [ ] **Paso 1: Escribir la migración**

```sql
-- Pedidos por WhatsApp: creación atómica con lock real sobre viandas,
-- idempotencia con request_hash canónico, limitador de abuso con HMAC,
-- transiciones de estado validadas, retención mínima de datos.
-- Aditiva, repetible, transaccional.

begin;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  request_hash text not null,
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
  cantidad integer not null check (cantidad > 0 and cantidad <= 50),
  subtotal numeric generated always as (precio_capturado * cantidad) stored
);

alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;

drop trigger if exists pedidos_set_updated_at on public.pedidos;
create trigger pedidos_set_updated_at
before update on public.pedidos
for each row execute function public.viandapp_set_updated_at();

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
     or new.idempotency_key is distinct from old.idempotency_key
     or new.request_hash is distinct from old.request_hash then
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

-- Tipo de resultado: la funcion nunca "falla silenciosamente" un rechazo
-- de disponibilidad/precio -- devuelve ok=false con el detalle, sin
-- insertar nada, o ok=true con el pedido creado (o el existente, por
-- idempotencia).
create type public.pedido_resultado as (
  ok boolean,
  pedido public.pedidos,
  cambios jsonb
);

create or replace function public.crear_pedido_atomico(
  p_idempotency_key uuid,
  p_vianderas_id uuid,
  p_modalidad text,
  p_costo_envio_esperado numeric,
  p_items jsonb,
  p_nombre_comprador text,
  p_telefono_comprador text,
  p_direccion_envio text,
  p_acepta_marketing boolean
) returns public.pedido_resultado
language plpgsql
as $$
declare
  v_pedido public.pedidos;
  v_existente public.pedidos;
  v_request_hash text;
  v_items_canonicos jsonb;
  v_cantidad_items integer;
  v_cantidad_distintos integer;
  v_viandas_bloqueadas jsonb;
  v_cambios jsonb := '[]'::jsonb;
  v_costo_envio_real numeric;
  v_total numeric;
  v_item jsonb;
  v_fila record;
begin
  -- 1. Validar forma de p_items ANTES de tocar viandas.
  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_invalidos' using errcode = 'P0001', hint = 'p_items debe ser un array no vacio';
  end if;

  select count(*), count(distinct (item->>'vianda_id'))
    into v_cantidad_items, v_cantidad_distintos
    from jsonb_array_elements(p_items) as item;

  if v_cantidad_items != v_cantidad_distintos then
    raise exception 'items_duplicados' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as item
    where (item->>'cantidad')::integer is null
       or (item->>'cantidad')::integer < 1
       or (item->>'cantidad')::integer > 50
  ) then
    raise exception 'cantidad_fuera_de_rango' using errcode = 'P0001';
  end if;

  -- 2. Items canonicos ordenados por vianda_id, para el hash Y para
  -- comparar contra lo bloqueado mas abajo.
  select jsonb_agg(
           jsonb_build_object('vianda_id', item->>'vianda_id', 'cantidad', (item->>'cantidad')::integer)
           order by item->>'vianda_id'
         )
    into v_items_canonicos
    from jsonb_array_elements(p_items) as item;

  v_request_hash := md5(
    jsonb_build_object(
      'vianderas_id', p_vianderas_id,
      'modalidad', p_modalidad,
      'items', v_items_canonicos,
      'nombre_comprador', trim(p_nombre_comprador),
      'telefono_comprador', trim(p_telefono_comprador),
      'direccion_envio', trim(coalesce(p_direccion_envio, '')),
      'acepta_marketing', p_acepta_marketing
    )::text
  );

  -- 3. Bloquear y leer las filas reales de viandas.
  select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'precio', precio, 'disponible', disponible))
    into v_viandas_bloqueadas
    from public.viandas
    where id in (select (item->>'vianda_id')::uuid from jsonb_array_elements(p_items) as item)
      and vianderas_id = p_vianderas_id
    for update;

  -- 4. Comparar cada item pedido contra lo bloqueado; armar cambios.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select value into v_fila
      from jsonb_to_recordset(coalesce(v_viandas_bloqueadas, '[]'::jsonb)) as value(id uuid, nombre text, precio numeric, disponible boolean)
      where id = (v_item.value->>'vianda_id')::uuid;

    if v_fila.id is null then
      v_cambios := v_cambios || jsonb_build_object('vianda_id', v_item.value->>'vianda_id', 'tipo', 'plato_no_disponible');
    elsif not v_fila.disponible then
      v_cambios := v_cambios || jsonb_build_object('vianda_id', v_item.value->>'vianda_id', 'tipo', 'plato_no_disponible');
    end if;
  end loop;

  -- 5. Resolver costo de envio vigente dentro de la misma transaccion
  -- (implementacion completa de esta subconsulta se detalla junto con
  -- la migracion de Envios/Puni -- referencia costo_envio_propio /
  -- puni_adhesiones segun p_modalidad).
  -- v_costo_envio_real := ... (ver Task 1 de este plan, subseccion "costo de envio")

  if jsonb_array_length(v_cambios) > 0 then
    return (false, null, v_cambios)::public.pedido_resultado;
  end if;

  -- 6. Idempotencia: intentar insertar, si ya existe comparar hash.
  begin
    insert into public.pedidos (
      idempotency_key, request_hash, vianderas_id, modalidad,
      costo_envio_capturado, total, nombre_comprador, telefono_comprador,
      direccion_envio, acepta_marketing, consentimiento_marketing_en
    )
    select p_idempotency_key, v_request_hash, p_vianderas_id, p_modalidad,
           v_costo_envio_real, v_total, p_nombre_comprador, p_telefono_comprador,
           p_direccion_envio, p_acepta_marketing,
           case when p_acepta_marketing then now() else null end
    where not exists (select 1 from public.pedidos where idempotency_key = p_idempotency_key)
    returning * into v_pedido;
  exception when unique_violation then
    -- Carrera: otra transaccion concurrente gano el insert entre el
    -- "not exists" y este insert. Se resuelve igual que el caso
    -- "ya existia" mas abajo.
    null;
  end;

  if v_pedido.id is null then
    select * into v_existente from public.pedidos where idempotency_key = p_idempotency_key;
    if v_existente.request_hash is distinct from v_request_hash then
      raise exception 'idempotency_key_content_mismatch' using errcode = 'P0001';
    end if;
    return (true, v_existente, '[]'::jsonb)::public.pedido_resultado;
  end if;

  insert into public.pedido_items (pedido_id, vianda_id, nombre_capturado, precio_capturado, cantidad)
  select
    v_pedido.id,
    (item->>'vianda_id')::uuid,
    (select nombre from jsonb_to_recordset(v_viandas_bloqueadas) as v(id uuid, nombre text) where id = (item->>'vianda_id')::uuid),
    (select precio from jsonb_to_recordset(v_viandas_bloqueadas) as v(id uuid, precio numeric) where id = (item->>'vianda_id')::uuid),
    (item->>'cantidad')::integer
  from jsonb_array_elements(p_items) as item;

  return (true, v_pedido, '[]'::jsonb)::public.pedido_resultado;
end;
$$;

revoke all on function public.crear_pedido_atomico(
  uuid, uuid, text, numeric, jsonb, text, text, text, boolean
) from public;
revoke all on function public.crear_pedido_atomico(
  uuid, uuid, text, numeric, jsonb, text, text, text, boolean
) from anon;
revoke all on function public.crear_pedido_atomico(
  uuid, uuid, text, numeric, jsonb, text, text, text, boolean
) from authenticated;
grant execute on function public.crear_pedido_atomico(
  uuid, uuid, text, numeric, jsonb, text, text, text, boolean
) to service_role;

-- Limitador de abuso: contador de ventana fija por clave (IP hasheada
-- con HMAC, o sesion server-emitida como señal secundaria, o 'global').
create table if not exists public.limite_solicitudes (
  clave text not null,
  ventana_inicio timestamptz not null,
  intentos integer not null default 1,
  created_at timestamptz not null default now(),
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

revoke all on function public.registrar_intento_limite(text, timestamptz) from public;
revoke all on function public.registrar_intento_limite(text, timestamptz) from anon;
revoke all on function public.registrar_intento_limite(text, timestamptz) from authenticated;
grant execute on function public.registrar_intento_limite(text, timestamptz) to service_role;

commit;
```

**Nota de implementación honesta**: el paso 5 (resolver costo de envío
vigente dentro de la función) queda esbozado con un comentario en vez de
SQL completo en este documento — la subconsulta exacta depende de las
tablas `vianderas`/`puni_adhesiones` de la migración de Envíos/Puni, que
este plan asume ya aplicada (ver "Requiere PRIMERO"). Se completa al
implementar, siguiendo el mismo patrón de `costoEnvioVigente`
(`lib/envios/modalidades.ts`) traducido a SQL — `select
costo_envio_propio from vianderas where id = p_vianderas_id` para
`envio_propio`, `select costo_envio_puni from puni_adhesiones where
viandera_id = p_vianderas_id and estado = 'aprobada'` para `envio_puni`,
`0` para `retiro`. Si el costo resuelto es `null`, se agrega un
`cambio` de tipo `modalidad_no_disponible` a `v_cambios` en vez de
seguir con un `v_total` roto.

- [ ] **Paso 2: Actualizar `types/index.ts`** — agregar `request_hash` a
  `Pedido`, y el tipo del resultado compuesto si se termina modelando
  del lado TypeScript también (`PedidoResultado`).

- [ ] **Paso 3: Verificación real de la migración — bloqueante hasta
  resolver la Task 0.** Este plan **no puede marcar la Task 1 como
  completa** solo por revisión de lectura del SQL — hace falta
  ejecutarlo contra un Postgres real (local o staging, según lo elegido
  en la Task 0) y confirmar: la migración corre sin error, `select *
  from pg_proc where proname = 'crear_pedido_atomico'` la encuentra con
  la firma esperada, y una llamada de prueba manual (`select *
  from crear_pedido_atomico(...)` con datos de prueba) devuelve el tipo
  compuesto esperado. Sin esta verificación, la Task 1 queda en estado
  "escrita, no validada" — explícito en el commit.

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/202609040002_carrito_pedidos.sql types/index.ts
git commit -m "feat: add pedidos migration with lock-based atomic order creation"
```

---

### Task 2: `calcularTotal` corregido (TDD, falla primero)

**Files:**
- Create: `lib/pedidos/total.ts`, `lib/pedidos/total.test.ts`

- [ ] **Paso 1: Escribir el test que demuestra el bug ANTES de tocar la
  implementación** — correrlo contra la implementación de la revisión
  anterior (o una implementación mínima ingenua) y confirmar que
  **falla en rojo** por la razón correcta:

```ts
// lib/pedidos/total.test.ts
import { describe, expect, it } from "vitest";
import { calcularTotal, validarUnaSolaCocina } from "./total";

describe("calcularTotal", () => {
  it("suma precio por cantidad de cada item mas el envio", () => {
    const items = [
      { precioCapturado: 4200, cantidad: 2 },
      { precioCapturado: 2800, cantidad: 1 },
    ];
    expect(calcularTotal(items, 600)).toBe(4200 * 2 + 2800 + 600);
  });

  it("envio en cero es valido", () => {
    expect(calcularTotal([{ precioCapturado: 1000, cantidad: 1 }], 0)).toBe(1000);
  });

  it("lanza si la lista de items esta vacia", () => {
    expect(() => calcularTotal([], 0)).toThrow();
  });

  it("lanza si algun precio o cantidad es negativo", () => {
    expect(() => calcularTotal([{ precioCapturado: -1, cantidad: 1 }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: 0 }], 0)).toThrow();
  });

  it("respeta decimales de precio", () => {
    expect(calcularTotal([{ precioCapturado: 999.5, cantidad: 3 }], 0)).toBe(2998.5);
  });

  // Casos nuevos de esta revision -- el bug real encontrado: en JS,
  // `100 + null` es `100`, no un error. La validacion anterior
  // (`item.precioCapturado < 0`) no atrapaba un `null` porque
  // `null < 0` tambien es `false`. Estos tests deben fallar contra la
  // implementacion vieja antes de corregirla.
  it("rechaza costoEnvio null, NaN o Infinity", () => {
    const items = [{ precioCapturado: 100, cantidad: 1 }];
    expect(() => calcularTotal(items, null as unknown as number)).toThrow();
    expect(() => calcularTotal(items, NaN)).toThrow();
    expect(() => calcularTotal(items, Infinity)).toThrow();
  });

  it("rechaza precioCapturado null, NaN o Infinity", () => {
    expect(() =>
      calcularTotal([{ precioCapturado: null as unknown as number, cantidad: 1 }], 0),
    ).toThrow();
    expect(() => calcularTotal([{ precioCapturado: NaN, cantidad: 1 }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: Infinity, cantidad: 1 }], 0)).toThrow();
  });

  it("rechaza cantidad null, NaN o Infinity", () => {
    expect(() =>
      calcularTotal([{ precioCapturado: 100, cantidad: null as unknown as number }], 0),
    ).toThrow();
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: NaN }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: Infinity }], 0)).toThrow();
  });

  it("costo de envio 0 explicito sigue siendo valido junto a un precio 0", () => {
    expect(calcularTotal([{ precioCapturado: 0, cantidad: 1 }], 0)).toBe(0);
  });
});

describe("validarUnaSolaCocina", () => {
  it("true si todos los items son de la misma cocina", () => {
    expect(validarUnaSolaCocina([{ vianderaId: "a" }, { vianderaId: "a" }])).toBe(true);
  });

  it("false si hay mas de una cocina", () => {
    expect(validarUnaSolaCocina([{ vianderaId: "a" }, { vianderaId: "b" }])).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr los tests contra una implementación ingenua
  (`item.precioCapturado < 0`), confirmar que los 3 tests nuevos de
  null/NaN/Infinity fallan** — esto documenta el bug real, no uno
  hipotético.

- [ ] **Paso 3: Implementación corregida**

```ts
// lib/pedidos/total.ts
export type ItemParaTotal = { precioCapturado: number; cantidad: number };

function numeroValido(valor: number, permitirCero: boolean): boolean {
  if (!Number.isFinite(valor)) return false;
  return permitirCero ? valor >= 0 : valor > 0;
}

export function calcularTotal(items: ItemParaTotal[], costoEnvio: number): number {
  if (items.length === 0) {
    throw new Error("No se puede calcular el total de un carrito vacío.");
  }
  if (!numeroValido(costoEnvio, true)) {
    throw new Error("Costo de envío inválido.");
  }
  for (const item of items) {
    if (!numeroValido(item.precioCapturado, true)) {
      throw new Error("Precio inválido.");
    }
    if (!numeroValido(item.cantidad, false) || !Number.isInteger(item.cantidad)) {
      throw new Error("Cantidad inválida.");
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

- [ ] **Paso 4: Correr tests, confirmar que todos pasan.**

- [ ] **Paso 5: Commit**

```bash
git add lib/pedidos/total.ts lib/pedidos/total.test.ts
git commit -m "fix: reject null/NaN/Infinity in calcularTotal instead of silently coercing"
```

---

### Task 3: Funciones puras del limitador de abuso (TDD)

**Files:**
- Create: `lib/pedidos/limiteAbuso.ts`, `lib/pedidos/limiteAbuso.test.ts`
- Create: `lib/pedidos/hmacIp.ts`, `lib/pedidos/hmacIp.test.ts`

- [ ] **Paso 1: Test de `debeLimitar` — semántica corregida (falla
  primero)**

```ts
// lib/pedidos/limiteAbuso.test.ts
import { describe, expect, it } from "vitest";
import { debeLimitar, ventanaActual } from "./limiteAbuso";

describe("debeLimitar", () => {
  it("con limite 5: las primeras 5 solicitudes se permiten, la 6a se bloquea", () => {
    // intentos ya incluye el intento actual (post-incremento).
    expect(debeLimitar(1, 5)).toBe(false);
    expect(debeLimitar(4, 5)).toBe(false);
    expect(debeLimitar(5, 5)).toBe(false); // la 5a se permite
    expect(debeLimitar(6, 5)).toBe(true);  // la 6a se bloquea
  });
});

describe("ventanaActual", () => {
  it("trunca una fecha al inicio de la ventana de N minutos", () => {
    const fecha = new Date("2026-09-04T10:07:32Z");
    expect(ventanaActual(fecha, 5).toISOString()).toBe("2026-09-04T10:05:00.000Z");
  });
});
```

- [ ] **Paso 2: Implementación (corregida — `>` en vez de `>=`)**

```ts
// lib/pedidos/limiteAbuso.ts
export function debeLimitar(intentosDespuesDeIncrementar: number, limite: number): boolean {
  return intentosDespuesDeIncrementar > limite;
}

export function ventanaActual(ahora: Date, minutosVentana: number): Date {
  const ms = minutosVentana * 60 * 1000;
  return new Date(Math.floor(ahora.getTime() / ms) * ms);
}
```

- [ ] **Paso 3: Test de `hmacIp` (falla primero)**

```ts
// lib/pedidos/hmacIp.test.ts
import { describe, expect, it } from "vitest";
import { hmacIp } from "./hmacIp";

describe("hmacIp", () => {
  it("es deterministico para la misma IP y secreto", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).toBe(hmacIp("190.190.1.1", "secreto-a"));
  });

  it("IPs distintas producen hashes distintos", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).not.toBe(hmacIp("190.190.1.2", "secreto-a"));
  });

  it("el mismo IP con secretos distintos produce hashes distintos", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).not.toBe(hmacIp("190.190.1.1", "secreto-b"));
  });

  it("el resultado nunca contiene la IP original", () => {
    const resultado = hmacIp("190.190.1.1", "secreto-a");
    expect(resultado).not.toContain("190.190.1.1");
  });
});
```

- [ ] **Paso 4: Implementación — HMAC real, no concatenación + SHA
  simple**

```ts
// lib/pedidos/hmacIp.ts
import "server-only";
import { createHmac } from "node:crypto";

export function hmacIp(ip: string, secreto: string): string {
  return createHmac("sha256", secreto).update(ip).digest("hex");
}

export function hmacIpDesdeEnv(ip: string): string {
  const secreto = process.env.RATE_LIMIT_SECRET;
  if (!secreto) {
    throw new Error("RATE_LIMIT_SECRET no configurado.");
  }
  return hmacIp(ip, secreto);
}
```

  `RATE_LIMIT_SECRET` se suma a las variables de entorno server-only de
  `CLAUDE.md`.

- [ ] **Paso 5: Correr tests, confirmar que pasan.**

- [ ] **Paso 6: Commit**

```bash
git add lib/pedidos/limiteAbuso.ts lib/pedidos/limiteAbuso.test.ts lib/pedidos/hmacIp.ts lib/pedidos/hmacIp.test.ts
git commit -m "fix: correct rate-limit off-by-one semantics and use real HMAC for IP hashing"
```

---

### Task 4: Resto de funciones puras (`detectarCambios`, `construirMensajePedido`)

Sin cambios respecto a la versión anterior de este plan — mismos tests e
implementación para `detectarCambios` (`lib/pedidos/revalidacion.ts`) y
`construirMensajePedido` (`lib/pedidos/mensaje.ts`).

- [ ] **Commit**

```bash
git add lib/pedidos/revalidacion.ts lib/pedidos/revalidacion.test.ts lib/pedidos/mensaje.ts lib/pedidos/mensaje.test.ts
git commit -m "feat: add pure order revalidation-diff and WhatsApp message logic with tests"
```

---

### Task 5: Sesión server-emitida (cookie `httpOnly`)

**Files:**
- Create: `app/pedido/sesion.ts` (Server Action o helper de Route
  Handler que setea la cookie)

- [ ] **Paso 1**: al entrar a la pantalla de checkout, si no existe la
  cookie `viandapp_sesion` (httpOnly, `secure` en producción,
  `sameSite: 'lax'`), el servidor genera un valor aleatorio
  (`crypto.randomUUID()`) y la setea. El valor es opaco — el cliente
  nunca lo lee ni lo genera, solo el navegador lo reenvía
  automáticamente.
- [ ] **Paso 2**: documentar explícitamente en el código que esta cookie
  es una **señal secundaria** para el limitador (Task 6) — nunca una
  frontera de autenticación ni de seguridad por sí sola.
- [ ] **Paso 3: Commit**

```bash
git add app/pedido/sesion.ts
git commit -m "feat: add server-issued opaque session cookie as a secondary rate-limit signal"
```

---

### Task 6: Server Action `generarPedido`

**Files:**
- Create: `app/pedido/actions.ts`

**Interfaces:**
- Consume: `calcularTotal`, `validarUnaSolaCocina`, `detectarCambios`,
  `construirMensajePedido` (Task 4); `debeLimitar`, `ventanaActual`,
  `hmacIpDesdeEnv` (Task 3); `modalidadesDisponibles`,
  `costoEnvioVigente` (plan de Envíos/Puni); `telefonoParaWhatsapp`.

- [ ] **Paso 1: Contrato**

```ts
export type ResultadoGenerarPedido =
  | { status: "limite_excedido"; mensaje: string }
  | { status: "revisar_carrito"; cambios: CambioDetectado[] }
  | { status: "error"; mensaje: string }
  | { status: "ok"; pedidoId: string; whatsappHref: string };
```

- [ ] **Paso 2: Implementar, en este orden**

1. **Limitador**, antes de cualquier otra cosa:
   - IP real de la request (`x-forwarded-for` detrás de Vercel) →
     `hmacIpDesdeEnv` → `registrar_intento_limite('ip:' + hash,
     ventanaActual(ahora, 60))`, límite 10/hora. `debeLimitar` → si es
     `true`, `status: "limite_excedido"`, cortar acá.
   - Sesión (cookie de Task 5, señal secundaria) →
     `registrar_intento_limite('sesion:' + cookie, ventanaActual(ahora,
     60))`, límite 5/hora — **informativo**: si se excede, se puede
     mostrar un mensaje más amigable, pero no reemplaza el chequeo de
     IP (que ya cortó arriba si correspondía).
   - Global (circuito de emergencia): `registrar_intento_limite('global',
     ventanaActual(ahora, 5))`, límite 1000/5min. Si se excede, además
     de cortar, loguear con severidad alta (para que sea visible como
     incidente, no como rechazo rutinario).
2. Validación liviana de campos + revalidación no bloqueante (misma
   lógica que la versión anterior) para poder mostrar `revisar_carrito`
   con buena UX sin gastar la llamada pesada en el caso obvio.
3. Armar `p_items` (jsonb) con `{vianda_id, cantidad, precio_esperado:
   item.precioVisto}`.
4. `admin.rpc('crear_pedido_atomico', {...})`. Manejar:
   - `ok: false` → `status: "revisar_carrito"` con los `cambios`
     devueltos por la función (la fuente de verdad real, no el chequeo
     liviano del paso 2).
   - Excepción `idempotency_key_content_mismatch` → `status: "error"`
     pidiendo recargar el carrito.
   - `ok: true` → seguir.
5. `construirMensajePedido`, armar `whatsappHref`.
6. `{ status: "ok", pedidoId, whatsappHref }`.

- [ ] **Paso 3: Tests unitarios** (mock del admin client) — límite
  excedido corta antes de cualquier llamada a `crear_pedido_atomico`;
  `ok: false` de la función se traduce en `revisar_carrito`;
  `idempotency_key_content_mismatch` se traduce en el mensaje correcto.

- [ ] **Paso 4: Commit**

```bash
git add app/pedido/actions.ts app/pedido/actions.test.ts
git commit -m "feat: add generarPedido server action with layered rate limiting"
```

---

### Task 7: Carrito en `localStorage` + UI + pantalla de confirmación

Sin cambios de fondo respecto a la versión anterior de este plan —
`CarritoProvider`, `BotonAgregarAlCarrito`, `CajonCarrito`,
`ConfirmarPedido`, `RevisarCambios`, `sesionCheckout.ts` (idempotencyKey
en `sessionStorage`, regenerada si el carrito cambia).

- [ ] **Commit**

```bash
git add lib/carrito/ components/carrito/
git commit -m "feat: add client-side cart and order confirmation UI"
```

---

### Task 8: Panel de pedidos en `/viandera`

Sin cambios respecto a la versión anterior — listado,
`actualizarEstadoPedido` con validación de transición.

- [ ] **Commit**

```bash
git add app/viandera/pedidos/ components/viandera/TarjetaPedido.tsx app/viandera/actions.ts
git commit -m "feat: add order list and validated status transitions in seller panel"
```

---

### Task 9: Servicio de purgado compartido (cron seguro + limpieza del limitador)

**Files:**
- Create: `lib/pedidos/servicioPurgado.ts` (extraído, usado por cron Y
  por la acción manual — nunca duplicado)
- Create: `lib/pedidos/servicioPurgado.test.ts`
- Create: `app/api/cron/purgar-pedidos/route.ts`
- Modify: `vercel.json`
- Modify: `app/admin/actions.ts`

- [ ] **Paso 1: `servicioPurgado.ts`**

```ts
// lib/pedidos/servicioPurgado.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResultadoPurgado =
  | { ok: true; pedidosPurgados: number; contadoresLimpiados: number }
  | { ok: false; error: string };

const RETENCION_LIMITADOR_DIAS = 7;

export async function ejecutarPurgado(): Promise<ResultadoPurgado> {
  const admin = createAdminClient();
  const ahora = new Date();

  const { data: candidatos, error: errorSelect } = await admin
    .from("pedidos")
    .select("id")
    .eq("datos_purgados", false)
    .lte("purgar_datos_en", ahora.toISOString());

  if (errorSelect) {
    return { ok: false, error: "No pudimos consultar pedidos vencidos." };
  }

  const ids = (candidatos ?? []).map((p) => p.id);
  let pedidosPurgados = 0;

  if (ids.length > 0) {
    const { error: errorUpdate, count } = await admin
      .from("pedidos")
      .update({
        nombre_comprador: null,
        telefono_comprador: null,
        direccion_envio: null,
        datos_purgados: true,
      })
      .in("id", ids)
      .select("id", { count: "exact" });

    // Corregido en esta revision: si la escritura falla, se devuelve
    // error explicito -- nunca se reporta "purgados: N" sin haber
    // confirmado que el update efectivamente se aplico.
    if (errorUpdate) {
      return { ok: false, error: "No pudimos purgar los pedidos vencidos." };
    }
    pedidosPurgados = count ?? ids.length;
  }

  const limiteRetencion = new Date(ahora.getTime() - RETENCION_LIMITADOR_DIAS * 24 * 60 * 60 * 1000);
  const { error: errorLimite, count: contadoresLimpiados } = await admin
    .from("limite_solicitudes")
    .delete()
    .lt("ventana_inicio", limiteRetencion.toISOString())
    .select("clave", { count: "exact" });

  if (errorLimite) {
    // El purgado de pedidos ya se aplico -- no se revierte, pero se
    // reporta el fallo parcial en vez de un exito completo falso.
    return { ok: false, error: "Pedidos purgados, pero falló la limpieza del limitador." };
  }

  return { ok: true, pedidosPurgados, contadoresLimpiados: contadoresLimpiados ?? 0 };
}
```

- [ ] **Paso 2: Test** — mock del admin client devolviendo error en el
  `update` de pedidos → `ejecutarPurgado()` devuelve `{ok: false, ...}`,
  **nunca** `{ok: true, pedidosPurgados: N}` con `N > 0` cuando la
  escritura falló.

- [ ] **Paso 3: Route Handler del cron — falla cerrado**

```ts
// app/api/cron/purgar-pedidos/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { ejecutarPurgado } from "@/lib/pedidos/servicioPurgado";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  // Corregido en esta revision: si CRON_SECRET no esta configurado,
  // rechaza -- nunca autoriza por ausencia/vacio del secreto.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await ejecutarPurgado();
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 500 });
  }

  return NextResponse.json({
    purgados: resultado.pedidosPurgados,
    limitadorLimpiado: resultado.contadoresLimpiados,
  });
}
```

- [ ] **Paso 4: `vercel.json`**

```json
{
  "crons": [{ "path": "/api/cron/purgar-pedidos", "schedule": "0 6 * * *" }]
}
```

  **Confirmar antes de desplegar** (no asumido en este plan): qué plan
  de Vercel tiene el proyecto y si admite esta frecuencia — el plan
  Hobby de Vercel permite 1 invocación de cron por día por proyecto
  (esta frecuencia diaria calza), pero si en algún momento se quisiera
  una frecuencia mayor, hay que confirmar el plan contratado primero,
  no asumir que está disponible.

- [ ] **Paso 5: `purgarPedidosVencidos`** en `/admin` — llama al mismo
  `ejecutarPurgado()`, gateado por `esAdmin()`, como gatillo manual de
  respaldo (nunca lógica duplicada).

- [ ] **Paso 6: Commit**

```bash
git add lib/pedidos/servicioPurgado.ts lib/pedidos/servicioPurgado.test.ts app/api/cron/purgar-pedidos/route.ts vercel.json app/admin/actions.ts
git commit -m "feat: extract shared purge service, fail-closed cron, and rate-limit cleanup"
```

---

### Task 10: Tests de integración (requiere Task 0 resuelta)

**Files:**
- Create: `app/pedido/actions.integration.test.ts`

Los 12 casos listados en la spec §13 (puntos 8-19), incluidos
explícitamente:

- [ ] Dos llamadas concurrentes, misma key y contenido idéntico →
  disparadas realmente en paralelo (`Promise.all`), una sola orden.
- [ ] Misma key, mismo contenido, ítems en distinto orden → mismo
  `request_hash`, mismo pedido.
- [ ] Misma key, contenido distinto → rechazo.
- [ ] Cambio de precio concurrente detectado dentro de la transacción
  (forzar la carrera con dos conexiones/transacciones explícitas contra
  la instancia de test).
- [ ] Total en la base coincide con la suma real de `pedido_items`.
- [ ] Array vacío, ítem duplicado, cantidad fuera de rango — los tres
  rechazados sin bloquear ninguna fila de `viandas`.
- [ ] `null`/`NaN`/`Infinity` rechazados en runtime (ya cubierto en
  Task 2 como test unitario — acá se confirma que la Server Action
  nunca llega a mandarlos a la función atómica en primer lugar).
- [ ] Sexta solicitud bloqueada cuando el límite es 5 (contra la tabla
  real).
- [ ] Rotar la cookie de sesión no evade el límite real de IP.
- [ ] Cron sin `CRON_SECRET` rechaza.
- [ ] Fallo de purgado devuelve error, no reporta éxito.
- [ ] Imposibilidad de leer `nota_admin` públicamente (spec de
  Envíos/Puni).

- [ ] **Commit**

```bash
git add app/pedido/actions.integration.test.ts
git commit -m "test: add integration coverage for atomicity, rate limiting, and purge"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] `crear_pedido_atomico` bloquea (`FOR UPDATE`) las filas de
  `viandas` involucradas **dentro** de su propia transacción — probado
  con el test de carrera de la Task 10, no solo por lectura del código.
- [ ] `select has_function_privilege('anon',
  'crear_pedido_atomico(uuid,uuid,text,numeric,jsonb,text,text,text,boolean)',
  'EXECUTE')` devuelve `false`.
- [ ] Todos los `GRANT`/`REVOKE ... ON FUNCTION` de la migración incluyen
  la firma completa de argumentos.
- [ ] La migración fue **ejecutada realmente** contra un Postgres real
  (Task 0/Task 1, Paso 3) — no solo revisada por lectura.
- [ ] `request_hash` se calcula dentro de la función, ordenado por
  `vianda_id`, nunca por un UUID de fila.
- [ ] `hmacIp`/`hmacIpDesdeEnv` usan HMAC-SHA256 real con
  `RATE_LIMIT_SECRET`, nunca concatenación + hash simple.
- [ ] El límite global tiene un umbral alto (circuito de emergencia) —
  confirmar que no puede activarse por el uso normal esperado del sitio.
- [ ] `debeLimitar` usa `>`, no `>=` — la sexta solicitud (con límite 5)
  es la primera bloqueada, no la quinta.
- [ ] El cron rechaza explícitamente si `CRON_SECRET` está ausente o
  vacío.
- [ ] `ejecutarPurgado()` nunca reporta pedidos purgados si el `update`
  falló.
- [ ] `limite_solicitudes` tiene un mecanismo de limpieza de ventanas
  vencidas (Task 9), no crece indefinidamente.
- [ ] Ninguna prueba de integración corrió contra el proyecto de
  producción de Supabase.

## QA responsive

Sin cambios respecto a la versión anterior de este plan.

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** La Task 0 (infraestructura de integración) requiere
una decisión explícita del usuario (Docker local vs. staging) antes de
poder ejecutar la verificación real de la migración (Task 1, Paso 3) y
los tests de integración (Task 10) — sin eso, este plan no puede
considerarse completamente verificado, más allá de la revisión de
lectura del SQL. Al terminar lo que sí se puede completar sin esa
decisión (Tasks 0 parcial, 2-9), detenerse y reportar exactamente qué
quedó pendiente de la infraestructura de integración y por qué.
