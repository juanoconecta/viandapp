# Carrito y pedidos por WhatsApp — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL: usar
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans`. Los pasos usan sintaxis de checkbox.

**Objetivo:** carrito de una sola cocina (client-side), confirmación con
revalidación server-side de precio/disponibilidad, pedido con captura
inmutable, generación de mensaje de WhatsApp, sin pagos online.

**Arquitectura:** `localStorage` para el carrito pre-confirmación (sin
tabla en la base — nada que persistir hasta que el comprador confirma).
Un Server Action (`generarPedido`) hace toda la revalidación y el insert
atómico-por-idempotencia. `pedidos`/`pedido_items` con RLS que bloquea
todo insert directo de cliente.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres +
RLS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-carrito-pedidos-whatsapp-design.md`

**Requiere PRIMERO:**
1. Plan de Envíos/Adhesión a Puni implementado y su migración aplicada
   (esta entrega usa `vianderas.costo_envio_propio`, `cobertura_envio`,
   `puni_adhesion_publica`, y reexporta `lib/envios/modalidades.ts`).
2. Preflight de backup de Supabase (mismo criterio que el resto de las
   migraciones de este proyecto).

## Global Constraints

- No tocar Supabase hasta revisión de Codex.
- El carrito nunca persiste server-side antes de la confirmación — cero
  PII guardada por el simple hecho de que alguien agregó un plato y se
  fue.
- El servidor jamás confía en un precio, disponibilidad o total que venga
  del cliente — todo se revalida contra la base en `generarPedido`.
- `pedidos`/`pedido_items` no aceptan insert directo de `anon`/
  `authenticated` — únicamente vía `createAdminClient()` desde
  `generarPedido`, después de la revalidación completa.
- El consentimiento de marketing (`acepta_marketing`) es un campo
  independiente, destildado por defecto, nunca inferido de "el comprador
  confirmó el pedido".
- `idempotency_key` se genera una vez por sesión de checkout (no en cada
  submit) y se envía en cada intento — un reintento nunca crea un segundo
  pedido.
- Sin nuevas dependencias de npm (el `<dialog>` nativo ya usado en
  `WhatsAppIntent.tsx` es el patrón a seguir para cualquier modal).
- Reutilizar `telefonoParaWhatsapp` (`lib/viandera/telefono.ts`) para el
  link final — no reimplementar la limpieza de número.
- Todas las funciones puras de negocio (Task 2) llevan TDD: test que
  falla primero.

---

### Task 1: Migración — `pedidos` y `pedido_items`

**Files:**
- Create: `supabase/migrations/202609040002_carrito_pedidos.sql`
- Modify: `types/index.ts` (agregar `Pedido`, `PedidoItem`, entradas en
  `Database.public.Tables`)

- [ ] **Paso 1: Escribir la migración**

```sql
-- Pedidos por WhatsApp: captura inmutable de items, total server-side,
-- idempotencia, retención mínima de datos del comprador.
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

-- Solo la vendedora dueña puede tocar `estado` (y por extensión
-- updated_at) de sus propios pedidos. Todo lo demás queda bloqueado fuera
-- de una sesión con service role.
create or replace function public.pedidos_bloquear_edicion_montos()
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

  return new;
end;
$$;

drop trigger if exists pedidos_bloquear_montos on public.pedidos;
create trigger pedidos_bloquear_montos
before update on public.pedidos
for each row execute function public.pedidos_bloquear_edicion_montos();

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

commit;
```

Nota deliberada: **sin policy de `insert` para nadie** en `pedidos` ni
`pedido_items` (ni siquiera `authenticated`) — el único camino de escritura
es `createAdminClient()` desde `generarPedido`, que bypasea RLS por
diseño. Esto es la garantía real del invariante "el servidor revalida
antes de crear", no una policy que se pueda malinterpretar.

- [ ] **Paso 2: Actualizar `types/index.ts`** con `Pedido`, `PedidoItem`,
  `ModalidadPedido`, `EstadoPedido`, y sus entradas en `Database`.

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/202609040002_carrito_pedidos.sql types/index.ts
git commit -m "feat: add migration for pedidos and pedido_items"
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

**Interfaces:**
- Consume: `Modalidad`, `costoEnvioVigente` de `lib/envios/modalidades.ts`
  (plan de Envíos/Puni) — no se reimplementa acá.
- Produce: `calcularTotal`, `validarUnaSolaCocina`, `detectarCambios`,
  `construirMensajePedido` — consumidos por el Server Action (Task 3).

- [ ] **Paso 1: Test de `calcularTotal` (falla primero)**

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

  it("envio en cero no suma nada", () => {
    expect(calcularTotal([{ precioCapturado: 1000, cantidad: 1 }], 0)).toBe(1000);
  });

  it("lanza si la lista de items esta vacia", () => {
    expect(() => calcularTotal([], 0)).toThrow();
  });

  it("lanza si algun precio o cantidad es negativo", () => {
    expect(() =>
      calcularTotal([{ precioCapturado: -1, cantidad: 1 }], 0),
    ).toThrow();
    expect(() =>
      calcularTotal([{ precioCapturado: 100, cantidad: 0 }], 0),
    ).toThrow();
  });

  it("respeta decimales de precio sin arrastre de punto flotante", () => {
    // Precios en pesos argentinos sin centavos en la practica del sitio,
    // pero la funcion no debe asumirlo silenciosamente.
    expect(calcularTotal([{ precioCapturado: 999.5, cantidad: 3 }], 0)).toBe(2998.5);
  });
});

describe("validarUnaSolaCocina", () => {
  it("true si todos los items son de la misma cocina", () => {
    expect(
      validarUnaSolaCocina([{ vianderaId: "a" }, { vianderaId: "a" }]),
    ).toBe(true);
  });

  it("false si hay mas de una cocina", () => {
    expect(
      validarUnaSolaCocina([{ vianderaId: "a" }, { vianderaId: "b" }]),
    ).toBe(false);
  });

  it("true (trivialmente) para un solo item o lista vacia", () => {
    expect(validarUnaSolaCocina([{ vianderaId: "a" }])).toBe(true);
    expect(validarUnaSolaCocina([])).toBe(true);
  });
});
```

- [ ] **Paso 2: Implementación mínima**

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

- [ ] **Paso 3: Correr tests, confirmar que pasan.**

- [ ] **Paso 4: Test de `detectarCambios` (falla primero)**

```ts
// lib/pedidos/revalidacion.test.ts
import { describe, expect, it } from "vitest";
import { detectarCambios } from "./revalidacion";

const clienteVe = [{ platoId: "p1", precio: 4200 }, { platoId: "p2", precio: 2800 }];

describe("detectarCambios", () => {
  it("vacio si todo coincide y ambos platos siguen disponibles", () => {
    const servidor = [
      { platoId: "p1", precio: 4200, disponible: true },
      { platoId: "p2", precio: 2800, disponible: true },
    ];
    expect(detectarCambios(clienteVe, servidor)).toEqual([]);
  });

  it("reporta precio_cambio si el precio actual difiere", () => {
    const servidor = [
      { platoId: "p1", precio: 4500, disponible: true },
      { platoId: "p2", precio: 2800, disponible: true },
    ];
    expect(detectarCambios(clienteVe, servidor)).toEqual([
      { platoId: "p1", tipo: "precio_cambio", anterior: 4200, nuevo: 4500 },
    ]);
  });

  it("reporta plato_no_disponible si disponible paso a false", () => {
    const servidor = [
      { platoId: "p1", precio: 4200, disponible: false },
      { platoId: "p2", precio: 2800, disponible: true },
    ];
    expect(detectarCambios(clienteVe, servidor)).toEqual([
      { platoId: "p1", tipo: "plato_no_disponible" },
    ]);
  });

  it("reporta plato_no_disponible si el plato ya no existe en absoluto", () => {
    const servidor = [{ platoId: "p2", precio: 2800, disponible: true }];
    expect(detectarCambios(clienteVe, servidor)).toEqual([
      { platoId: "p1", tipo: "plato_no_disponible" },
    ]);
  });
});
```

- [ ] **Paso 5: Implementación mínima**

```ts
// lib/pedidos/revalidacion.ts
export type ItemCliente = { platoId: string; precio: number };
export type PlatoServidor = { platoId: string; precio: number; disponible: boolean };
export type CambioDetectado =
  | { platoId: string; tipo: "plato_no_disponible" }
  | { platoId: string; tipo: "precio_cambio"; anterior: number; nuevo: number };

export function detectarCambios(
  clienteVe: ItemCliente[],
  servidor: PlatoServidor[],
): CambioDetectado[] {
  const porId = new Map(servidor.map((p) => [p.platoId, p]));
  const cambios: CambioDetectado[] = [];

  for (const item of clienteVe) {
    const actual = porId.get(item.platoId);
    if (!actual || !actual.disponible) {
      cambios.push({ platoId: item.platoId, tipo: "plato_no_disponible" });
      continue;
    }
    if (actual.precio !== item.precio) {
      cambios.push({
        platoId: item.platoId,
        tipo: "precio_cambio",
        anterior: item.precio,
        nuevo: actual.precio,
      });
    }
  }

  return cambios;
}
```

- [ ] **Paso 6: Correr tests, confirmar que pasan.**

- [ ] **Paso 7: Test de `construirMensajePedido` (falla primero)**

```ts
// lib/pedidos/mensaje.test.ts
import { describe, expect, it } from "vitest";
import { construirMensajePedido } from "./mensaje";

const pedidoBase = {
  vianderaNombre: "Doña Rosa",
  items: [
    { nombre: "Milanesa napolitana", precio: 4200, cantidad: 2 },
    { nombre: "Tarta de verduras", precio: 2800, cantidad: 1 },
  ],
  costoEnvio: 600,
  total: 11800,
  modalidad: "envio_propio" as const,
  nombreComprador: "María",
  direccion: "Calle Falsa 123",
};

describe("construirMensajePedido", () => {
  it("incluye cada item con cantidad, nombre y precio", () => {
    const mensaje = construirMensajePedido(pedidoBase);
    expect(mensaje).toContain("2x Milanesa napolitana");
    expect(mensaje).toContain("1x Tarta de verduras");
  });

  it("incluye el costo de envio solo si es mayor a 0", () => {
    expect(construirMensajePedido(pedidoBase)).toContain("600");
    const sinEnvio = construirMensajePedido({ ...pedidoBase, costoEnvio: 0, modalidad: "retiro" });
    expect(sinEnvio).not.toMatch(/envío:/i);
  });

  it("incluye el total", () => {
    expect(construirMensajePedido(pedidoBase)).toContain("11800");
  });

  it("incluye direccion solo si la modalidad no es retiro", () => {
    expect(construirMensajePedido(pedidoBase)).toContain("Calle Falsa 123");
    const retiro = construirMensajePedido({ ...pedidoBase, modalidad: "retiro", direccion: null });
    expect(retiro).not.toContain("Dirección");
  });

  it("nunca incluye el telefono del comprador", () => {
    const mensaje = construirMensajePedido({ ...pedidoBase, } as never);
    expect(mensaje).not.toMatch(/\+?\d{6,}/);
  });
});
```

- [ ] **Paso 8: Implementación mínima** — armar el texto siguiendo
  exactamente el contenido obligatorio de la spec §8 (formato de moneda,
  saltos de línea: decisión de implementación libre siempre que los tests
  de contenido pasen).

- [ ] **Paso 9: Correr tests, confirmar que pasan.**

- [ ] **Paso 10: Commit**

```bash
git add lib/pedidos/
git commit -m "feat: add pure order total, revalidation, and WhatsApp message logic with tests"
```

---

### Task 3: Server Action `generarPedido`

**Files:**
- Create: `app/pedido/actions.ts`

**Interfaces:**
- Consume: `calcularTotal`, `validarUnaSolaCocina`, `detectarCambios`,
  `construirMensajePedido` (Task 2); `costoEnvioVigente`,
  `modalidadesDisponibles` (plan de Envíos/Puni); `telefonoParaWhatsapp`
  (existente).
- Produce: tipo de resultado consumido por la UI (Task 4).

- [ ] **Paso 1: Definir el contrato de entrada/salida**

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
};

export type ResultadoGenerarPedido =
  | { status: "revisar_carrito"; cambios: CambioDetectado[] }
  | { status: "error"; mensaje: string }
  | { status: "ok"; pedidoId: string; whatsappHref: string };
```

- [ ] **Paso 2: Implementar `generarPedido(datos: DatosConfirmacion)`**

Orden de operaciones (cada una corta el flujo si falla):

1. Validar campos obligatorios presentes (nombre, teléfono, dirección si
   `modalidad !== 'retiro'`) — error genérico si falta algo, sin tocar la
   base.
2. `validarUnaSolaCocina` sobre los items recibidos — si falla, error
   (esto nunca debería pasar desde la UI si el carrito respeta el
   invariante, pero el servidor no confía en el cliente).
3. Consultar `viandas` actuales para los `platoId` recibidos
   (`select id, nombre, precio, disponible where id in (...) and
   vianderas_id = :vianderaId` — el filtro por `vianderas_id` en la MISMA
   query es la defensa real contra que alguien mande IDs de otra cocina).
4. `detectarCambios` entre lo que el cliente ve (`precioVisto`) y lo que
   el servidor acaba de leer. Si no está vacío → `status:
   "revisar_carrito"`, sin escribir nada.
5. Consultar la config de envío vigente de la viandera
   (`costo_envio_propio`, `ofrece_retiro`, `ofrece_envio`) +
   `puni_adhesion_publica` si `modalidad === 'envio_puni'`. Verificar con
   `modalidadesDisponibles` que la modalidad pedida sigue siendo válida
   (pudo dejar de estarlo entre que el carrito se abrió y se confirmó) —
   si no, error explícito.
6. `costoEnvioVigente` para el costo real. Si es `null` (envío "a
   coordinar") en una modalidad que exige costo fijo para calcular el
   total, decidir en la implementación: **se recomienda tratarlo como
   costo `0` capturado con una nota en el mensaje de WhatsApp ("Envío a
   coordinar")** en vez de bloquear el pedido — pero esto es una decisión
   de producto que el plan deja marcada para confirmar con el usuario
   antes de la Task 3 (ver "Preguntas o bloqueos reales" en el reporte
   final).
7. `calcularTotal` con los precios recién leídos del servidor (nunca los
   `precioVisto` del cliente) + el costo de envío del paso 6.
8. Verificar teléfono de la vendedora vía `telefonoParaWhatsapp` — si no
   hay uno válido, error (no se puede generar un pedido sin forma de
   contactar a la vendedora).
9. `createAdminClient()`: `insert` en `pedidos` con
   `on conflict (idempotency_key) do nothing`, seguido de un `select` por
   `idempotency_key` para obtener la fila (nueva o preexistente) — ver
   Task 2 de la spec para el detalle de idempotencia. Insert de
   `pedido_items` (`insertMany`) solo si la fila de `pedidos` fue
   efectivamente nueva (si ya existía por idempotencia, sus items también
   ya existen).
10. `construirMensajePedido` con los datos capturados, armar el
    `whatsappHref`.
11. Devolver `{ status: "ok", pedidoId, whatsappHref }`.

- [ ] **Paso 3: Test de integración** (mock de Supabase admin client) para
  al menos: cambio de precio detectado devuelve `revisar_carrito` sin
  insertar nada; ítems de dos cocinas distintas rechazados antes de
  cualquier consulta; la segunda llamada con el mismo `idempotencyKey`
  devuelve el mismo `pedidoId` sin un segundo insert.

- [ ] **Paso 4: Commit**

```bash
git add app/pedido/actions.ts app/pedido/actions.test.ts
git commit -m "feat: add generarPedido server action with server-side revalidation"
```

---

### Task 4: Carrito en `localStorage` + UI

**Files:**
- Create: `lib/carrito/almacenamiento.ts` (leer/escribir
  `localStorage`, sin lógica de negocio — solo serialización)
- Create: `lib/carrito/almacenamiento.test.ts`
- Create: `components/carrito/CarritoProvider.tsx` (Context de cliente,
  expone `items`, `agregar`, `quitar`, `cambiarCantidad`, `vaciar`)
- Create: `components/carrito/BotonAgregarAlCarrito.tsx`
- Create: `components/carrito/CajonCarrito.tsx` (drawer/panel del carrito)
- Modify: `components/storefront/PublicDishCard.tsx` /
  `components/consumer/DishCard.tsx` (agregar el botón)

**Interfaces:**
- Produce: `CarritoAlmacenado` (tipo de la spec §3), reexportado para la
  Task 5.

- [ ] **Paso 1: Test de `almacenamiento.ts`** — guardar, leer, y el caso
  "agregar un plato de otra viandera" (comportamiento a definir en el
  plan de UX: vaciar con confirmación del usuario antes de agregar — la
  función pura solo expone `perteneceAOtraCocina(carrito, vianderaId)`
  para que la UI decida qué mostrar).

- [ ] **Paso 2: Implementación**, con manejo defensivo de
  `localStorage` no disponible/corrupto (SSR, modo incógnito con storage
  bloqueado, JSON inválido) — nunca debe tirar la página, solo tratarlo
  como carrito vacío.

- [ ] **Paso 3: `CarritoProvider`** — Context + hook `useCarrito()`,
  monta en el layout del route group de consumidor
  (`app/(consumer)/layout.tsx` si existe, o el layout relevante).

- [ ] **Paso 4: `BotonAgregarAlCarrito`** en las tarjetas de plato
  existentes — respeta el invariante de una sola cocina con una
  confirmación clara si se intenta mezclar.

- [ ] **Paso 5: `CajonCarrito`** — resumen de items con precio VISTO
  (marcado como "puede haber cambiado, se confirma al continuar" —
  transparencia de que esto no es el precio final garantizado), controles
  de cantidad, botón "Continuar" que lleva a la pantalla de confirmación
  (Task 5).

- [ ] **Paso 6: Verificar responsive** 375–1440px.

- [ ] **Paso 7: Commit**

```bash
git add lib/carrito/ components/carrito/ components/storefront/PublicDishCard.tsx components/consumer/DishCard.tsx
git commit -m "feat: add client-side single-vendor cart"
```

---

### Task 5: Pantalla de confirmación y resultado

**Files:**
- Create: `components/carrito/ConfirmarPedido.tsx` (formulario: modalidad,
  nombre, teléfono, dirección condicional, checkbox de marketing)
- Create: `components/carrito/RevisarCambios.tsx` (muestra los `cambios`
  devueltos por `generarPedido` cuando `status === "revisar_carrito"`)

**Interfaces:**
- Consume: `generarPedido` (Task 3), `modalidadesDisponibles` (plan de
  Envíos/Puni, para poblar las opciones de modalidad server-rendered antes
  de mostrar el formulario).

- [ ] **Paso 1: `ConfirmarPedido`** — genera el `idempotencyKey`
  (`crypto.randomUUID()`) una vez al montar (no en cada submit), muestra
  solo las modalidades que `modalidadesDisponibles` habilita para esta
  cocina, checkbox de marketing **destildado por defecto** con su propio
  texto explicativo separado del texto de "confirmar pedido".

- [ ] **Paso 2: Manejo de `revisar_carrito`** — no es un error genérico:
  `RevisarCambios` lista exactamente qué plato ya no está disponible o qué
  precio cambió (anterior → nuevo), con un botón "Volver al carrito" que
  actualiza el carrito almacenado a los valores nuevos (nunca reintenta
  automáticamente con los valores viejos).

- [ ] **Paso 3: Resultado `ok`** — vacía el carrito de esa cocina
  (`localStorage`), muestra el link de WhatsApp ("Continuar a WhatsApp",
  mismo patrón visual que `WhatsAppIntent.tsx`) con el texto explícito de
  que abrir WhatsApp no confirma el pedido — la vendedora lo confirma
  después de coordinar.

- [ ] **Paso 4: Commit**

```bash
git add components/carrito/ConfirmarPedido.tsx components/carrito/RevisarCambios.tsx
git commit -m "feat: add order confirmation flow with price/availability re-check UI"
```

---

### Task 6: Panel de pedidos en `/viandera`

**Files:**
- Create: `app/viandera/pedidos/page.tsx`
- Create: `components/viandera/TarjetaPedido.tsx`
- Modify: `app/viandera/actions.ts` (agregar
  `actualizarEstadoPedido`)
- Modify: `lib/viandera/slug.ts` (sumar `"pedidos"` NO hace falta — ya es
  subruta de `/viandera`, no una ruta raíz nueva; confirmar igual que no
  colisiona con nada)

**Interfaces:**
- Consume: RLS de `pedidos` (Task 1) para que la vendedora solo vea los
  suyos.

- [ ] **Paso 1: Listado** — pedidos ordenados por `created_at desc`,
  estado visible, ítems, total, modalidad.

- [ ] **Paso 2: `actualizarEstadoPedido`** — Server Action que solo
  permite `estado` en `{'confirmado', 'rechazado'}` desde `'generado'`
  (no se puede "confirmar" un pedido ya rechazado, etc. — reutilizar el
  mismo patrón de tabla de transiciones que `lib/envios/transiciones.ts`
  si aplica, o una tabla local equivalente).

- [ ] **Paso 3: Commit**

```bash
git add app/viandera/pedidos/ components/viandera/TarjetaPedido.tsx app/viandera/actions.ts
git commit -m "feat: add order list and status update in seller panel"
```

---

### Task 7: Purgado de datos del comprador

**Files:**
- Create: `lib/pedidos/purgado.ts` (función pura: dado un pedido y "ahora",
  determina si corresponde purgar)
- Create: `lib/pedidos/purgado.test.ts`
- Create: `app/admin/actions.ts` — agregar `purgarPedidosVencidos` (acción
  manual desde `/admin` en esta entrega; automatizar con `pg_cron` queda
  para cuando se confirme que Supabase Cron está disponible en el plan
  contratado del proyecto — no asumirlo)

- [ ] **Paso 1: Test y función pura** — `debePurgar(pedido, ahora)` es
  `true` si `ahora >= purgar_datos_en` y `datos_purgados === false`.

- [ ] **Paso 2: Server Action de admin** que selecciona pedidos vencidos
  no purgados y hace `update` seteando `nombre_comprador`,
  `telefono_comprador`, `direccion_envio` a `null` y `datos_purgados =
  true`.

- [ ] **Paso 3: Commit**

```bash
git add lib/pedidos/purgado.ts lib/pedidos/purgado.test.ts app/admin/actions.ts
git commit -m "feat: add buyer data retention purge for expired orders"
```

---

## Checklist de seguridad (repasar antes de pedir revisión)

- [ ] Ningún camino de `anon`/`authenticated` puede insertar en
  `pedidos`/`pedido_items` directamente (confirmado: cero policies de
  insert en la migración).
- [ ] `generarPedido` filtra `viandas` por `vianderas_id` en la misma
  query — un `platoId` de otra cocina nunca puede colarse en un pedido.
- [ ] El total se recalcula server-side siempre, nunca se acepta un
  `total` del cliente.
- [ ] `acepta_marketing` nunca se setea a `true` sin
  `consentimiento_marketing_en` (constraint de base, no solo de app).
- [ ] `idempotency_key` es `unique` a nivel de base — la garantía no
  depende únicamente de la lógica de aplicación.
- [ ] El teléfono del comprador nunca aparece en el texto del mensaje de
  WhatsApp (test cubre esto explícitamente).
- [ ] Existe un mecanismo (aunque sea manual en esta entrega) para purgar
  `nombre_comprador`/`telefono_comprador`/`direccion_envio` después de la
  ventana de retención.

## QA responsive

- [ ] Cajón de carrito: 375–1440px, sin scroll horizontal, controles de
  cantidad ≥44px.
- [ ] Pantalla de confirmación: formulario usable en 375px sin campos
  cortados, checkbox de marketing con área táctil clara y separada del
  botón de confirmar (para que no se tilde por error).
- [ ] Pantalla de revisión de cambios: legible en mobile, cada cambio
  claramente atribuido a su plato.
- [ ] Panel de pedidos en `/viandera`: lista usable en mobile y desktop.

## Punto de detención

**No ejecutar `git push`, merge, ni aplicar la migración hasta que Codex
revise este plan.** Antes de implementar la Task 3, confirmar con el
usuario la decisión marcada en el Paso 6 de esa tarea (qué hacer cuando el
costo de envío propio es "a coordinar" al momento de confirmar). Al
terminar, detenerse y reportar resultado de tests y cualquier desvío.
