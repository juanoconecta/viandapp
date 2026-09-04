# Carrito y pedidos por WhatsApp — Diseño

**Fecha:** 2026-09-04
**Estado:** Propuesto — pendiente de revisión de Codex
**Depende de:** Envíos y adhesión a Puni (necesita `vianderas.costo_envio_propio`,
`vianderas.cobertura_envio` y `puni_adhesiones` para calcular costo de envío
y ofrecer la modalidad Puni). Ver "Orden recomendado de implementación" en
el reporte final.

## 1. Objetivo

Reemplazar el flujo actual de "consultar por WhatsApp un solo plato"
(`WhatsAppIntent.tsx`) por uno de carrito multi-plato de **una sola
cocina**, que termina igual en WhatsApp — sin pagos online, sin cuenta de
consumidor, sin checkout propio. ViandApp arma el pedido y el mensaje;
comprador y vendedor confirman y coordinan fuera de la app.

## 2. Invariantes no negociables

Copiados textual de lo pedido, porque son la especificación misma, no una
interpretación:

1. **Una cocina por carrito.** Agregar un plato de otra viandera vacía el
   carrito anterior (con confirmación) o directamente lo rechaza — decisión
   de UX en el plan, pero el invariante en el servidor es innegociable: el
   servidor rechaza cualquier pedido cuyos ítems no pertenezcan todos a la
   misma `vianderas_id`.
2. **Revalidación server-side obligatoria.** Antes de crear el pedido, el
   servidor vuelve a consultar `viandas.disponible` y `viandas.precio`
   directo de la base — nunca confía en lo que el cliente dice que vio.
3. **Captura inmutable.** El pedido guarda `nombre_capturado` y
   `precio_capturado` de cada plato en el momento de la confirmación. Si
   después el plato cambia de nombre o precio, o se borra, el pedido ya
   generado no cambia.
4. **Total exacto.** `total = Σ(precio_capturado × cantidad) + costo_envio_capturado`.
   Sin redondeos ocultos, sin cargos no declarados.
5. **Si cambió un precio, el comprador revisa de nuevo.** Nunca se
   recalcula y se sigue en silencio — se muestra qué cambió y se pide
   confirmación explícita.
6. **Sin pagos online.** Ningún campo de tarjeta, ningún gateway. El pedido
   termina en un link de WhatsApp.
7. **Abrir WhatsApp no es confirmar.** El estado inicial del pedido
   (`generado`) no significa que el mensaje se envió ni que la vendedora lo
   vio. Solo la vendedora, manualmente desde `/viandera`, puede marcarlo
   `confirmado` o `rechazado` después de hablar con la compradora.

## 3. Carrito: dónde vive

Sin cuenta de consumidor (el explorador MVP es explícitamente sin
registro — no se revierte eso acá). El carrito es **puramente de
cliente**: `localStorage`, scoped a una `vianderaId`. No hay tabla
`carritos` en la base — no hay nada que persistir server-side hasta que el
comprador decide confirmar. Esto también resuelve solo la privacidad: no
se guarda ni un ítem elegido si la persona nunca llega a confirmar.

Estructura en `localStorage` (clave `viandapp:carrito`):

```ts
type CarritoAlmacenado = {
  vianderaId: string;
  items: { platoId: string; cantidad: number }[];
};
```

Sin precios ni nombres en el carrito almacenado — esos se resuelven
siempre contra el servidor al mostrar el carrito y de nuevo al confirmar
(doble fuente de verdad: la UI puede mostrar el precio que vio al agregar
para una previsualización optimista, pero la confirmación real siempre
revalida).

## 4. Flujo

```
1. Consumidor navega /{slug} o /explorar, agrega platos al carrito (localStorage).
2. Abre el carrito → GET server-side de los platos actuales (precio/disponibilidad
   frescos) para mostrar el resumen real, no el cacheado.
3. Elige modalidad: retiro | envío propio | envío Puni (solo si la viandera
   tiene puni_adhesiones.estado = 'aprobada').
4. Completa nombre + teléfono (obligatorios para coordinar) y dirección
   (obligatoria solo si la modalidad es de envío).
5. Tilda (opcional, sin marcar por defecto) "Quiero que me avisen de nuevas
   cocinas" — consentimiento de marketing, separado del envío del pedido.
6. Confirma → Server Action `generarPedido`:
   a. Revalida disponibilidad y precio de cada ítem.
   b. Si algo cambió → responde `revisar_carrito` con el detalle, sin crear nada.
   c. Si todo coincide → crea `pedidos` + `pedido_items` (idempotente, ver §6),
      calcula el total server-side, arma el mensaje de WhatsApp.
7. Cliente recibe el link `wa.me/...` y lo abre. El pedido queda en estado
   `generado`.
8. La vendedora, desde /viandera, ve el pedido y lo marca `confirmado` o
   `rechazado` después de coordinar por WhatsApp.
```

## 5. Modelo de datos

### `pedidos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `idempotency_key` | `uuid` | `unique not null` — ver §6 |
| `vianderas_id` | `uuid` | FK `vianderas`, `on delete restrict` (no se borra un pedido histórico si la cocina se da de baja) |
| `modalidad` | `text` | `check in ('retiro','envio_propio','envio_puni')` |
| `costo_envio_capturado` | `numeric` | `not null default 0 check (>= 0)` |
| `total` | `numeric` | `not null check (>= 0)` — recalculado y verificado server-side, nunca aceptado del cliente |
| `estado` | `text` | `check in ('generado','confirmado','rechazado','cancelado')`, default `'generado'` |
| `nombre_comprador` | `text` | Transitorio — ver §7 |
| `telefono_comprador` | `text` | Transitorio |
| `direccion_envio` | `text` | Transitorio, solo relevante si `modalidad != 'retiro'` |
| `acepta_marketing` | `boolean` | `not null default false` |
| `consentimiento_marketing_en` | `timestamptz` | Nullable, seteado solo si `acepta_marketing = true` |
| `purgar_datos_en` | `timestamptz` | `not null default (now() + interval '90 days')` — **90 días es una propuesta, no una cifra confirmada por el negocio; ver "Preguntas o bloqueos reales" en el reporte final** |
| `datos_purgados` | `boolean` | `not null default false` |
| `created_at` / `updated_at` | `timestamptz` | |

### `pedido_items`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `pedido_id` | `uuid` | FK `pedidos`, `on delete cascade` |
| `vianda_id` | `uuid` | FK `viandas`, `on delete set null` — referencia de conveniencia, **no** autoritativa |
| `nombre_capturado` | `text` | `not null` |
| `precio_capturado` | `numeric` | `not null check (>= 0)` |
| `cantidad` | `integer` | `not null check (> 0)` |
| `subtotal` | `numeric` | `generated always as (precio_capturado * cantidad) stored` — garantía a nivel de schema, no solo de aplicación |

`pedidos.total` se verifica en el Server Action como
`Σ(pedido_items.subtotal) + costo_envio_capturado` antes del insert — si no
coincide (no debería poder pasar si el cálculo es correcto, pero es la
red de seguridad), la operación falla con un error 500 explícito en vez de
guardar un total inconsistente.

## 6. Idempotencia

El cliente genera un `idempotency_key` (UUID v4) **una sola vez**, en el
momento en que se abre la pantalla de confirmación del carrito (no en cada
click de "Confirmar pedido" — si el comprador reintenta por un error de
red, debe reenviar la misma key). Se guarda en el estado del formulario,
no en `localStorage` (no debe sobrevivir a un refresh completo de página —
si la persona recarga la pantalla de confirmación, es razonable tratarlo
como un intento nuevo).

`generarPedido` hace `insert ... on conflict (idempotency_key) do nothing
returning *` seguido de un `select` si el insert no devolvió fila (ya
existía) — devuelve el pedido existente en vez de crear un duplicado o
fallar. Un doble-click o un reintento de red nunca genera dos pedidos.

## 7. Privacidad: minimización de datos del comprador

- `nombre_comprador`, `telefono_comprador`, `direccion_envio` se guardan
  porque la vendedora los necesita para coordinar (y porque el pedido en
  `/viandera` es más útil con contexto) — pero no indefinidamente.
- `purgar_datos_en` marca cuándo un job (Supabase cron / `pg_cron`, o en
  su defecto una Server Action que el admin dispara manualmente desde
  `/admin` hasta que se automatice) nullea esos tres campos y marca
  `datos_purgados = true`. El resto del pedido (ítems, total, modalidad,
  fechas, estado) **no se borra** — sigue siendo el historial de ventas de
  la vendedora y la base del CRM.
- El consentimiento de marketing (`acepta_marketing`) es independiente:
  aceptar el pedido nunca implica aceptar marketing, y el checkbox
  correspondiente arranca **destildado**.

## 8. Generación del mensaje de WhatsApp

Reutiliza `telefonoParaWhatsapp` (`lib/viandera/telefono.ts`) para el
número de la vendedora — mismo criterio que `WhatsAppIntent.tsx` hoy: si
no hay teléfono válido, no se puede llegar a confirmar el pedido (el
carrito debe avisar esto ANTES de pedir los datos del comprador, no
después).

Mensaje (server-side, determinístico, `encodeURIComponent` al armar el
link — mismo patrón que `WhatsAppIntent.tsx`):

```
Hola! Quiero hacer un pedido en ViandApp:

- 2x Milanesa napolitana — $4200
- 1x Tarta de verduras — $2800

Envío propio: $600
Total: $11 800

Retiro/envío: Envío propio
Nombre: María
Dirección: [dirección]

¿Está todo disponible?
```

El texto exacto (saltos de línea, formato de moneda, si se listan
ítems con guion o número) se termina de definir en el plan de
implementación con tests — acá se fija el **contenido obligatorio**: cada
ítem con cantidad/nombre/precio, costo de envío si aplica, total,
modalidad, nombre del comprador, dirección si aplica. Nunca se incluye el
teléfono del comprador en el texto del mensaje (WhatsApp ya lo expone al
remitente por el chat mismo — repetirlo en el cuerpo es redundante y
aumenta la superficie de datos en un texto que además queda en el
historial de chat de ambos lados).

## 9. Panel de la vendedora (`/viandera`)

Nueva sección (no reemplaza nada existente) para listar pedidos recibidos:
fecha, cliente, ítems, total, modalidad, estado. Acción: marcar
`confirmado` / `rechazado`. Sin edición de montos ni ítems desde acá — un
pedido ya generado es inmutable en su contenido, solo su `estado` cambia.

## 10. Acceso y RLS

- `pedidos`/`pedido_items`: RLS habilitado.
  - **Sin policy de insert para `anon`/`authenticated`** — todo insert pasa
    por `generarPedido` (Server Action) usando `createAdminClient()`
    después de revalidar todo. El comprador nunca escribe directo a la
    tabla.
  - Policy de select para la vendedora: `vianderas_id in (select id from
    vianderas where user_id = auth.uid())`.
  - Policy de update para la vendedora, **limitada a `estado`**: un
    trigger `pedidos_bloquear_edicion_montos()` rechaza cualquier `update`
    que intente cambiar `total`, `costo_envio_capturado`,
    `nombre_comprador`, `telefono_comprador`, `direccion_envio` o
    `vianderas_id` fuera de una sesión con service role — la vendedora
    solo puede tocar `estado` (y por extensión `updated_at`).
  - `pedido_items` no tiene policy de update en absoluto para
    `authenticated` (son inmutables una vez creados) — la vendedora los
    lee vía la policy de select de `pedidos` (join).

## 11. Cobertura de TDD requerida

Explícitamente pedida por el usuario — funciones puras, sin I/O, testeadas
antes de integrarlas:

1. `calcularTotal(items, costoEnvio)` — suma exacta, casos: cantidad
   cero/negativa rechazada por tipo, precio con decimales, envío cero,
   lista vacía (debería ser un estado de error en la capa de arriba, no un
   total de $0 silencioso).
2. `detectarCambios(itemsCliente, itemsServidor)` — dado lo que el
   cliente cree tener vs. lo que el servidor ve ahora mismo (precio,
   disponibilidad), devuelve la lista de diffs (`plato_no_disponible`,
   `precio_cambio` con valor anterior/nuevo). Vacío significa "todo
   coincide, se puede confirmar".
3. `validarUnaSolaCocina(items)` — dado un array de `{vianderaId, ...}`,
   `true` solo si todos comparten la misma `vianderaId`.
4. `construirMensajePedido(pedido)` — determinístico, un test por cada
   pieza de contenido obligatorio de §8 (aparece el total, aparece cada
   ítem, aparece el costo de envío solo si `costoEnvio > 0`, nunca aparece
   el teléfono del comprador).
5. `resolverModalidadesDisponibles(viandera, adhesionPuni)` — dado el
   estado de envío de la cocina, qué modalidades mostrar (retiro solo si
   `ofrece_retiro`, envío propio solo si `ofrece_envio`, Puni solo si
   `adhesionPuni?.estado === 'aprobada'`).

## 12. Fuera de alcance de esta entrega

- Pagos online de cualquier tipo.
- Notificaciones push/email al vendedor (se entera por WhatsApp, que es
  justamente el canal).
- Edición de un pedido ya generado por parte del comprador.
- Multi-cocina en un solo pedido.
- Cancelación automática por timeout (el estado `cancelado` existe en el
  enum para uso futuro/manual, no se dispara solo en esta entrega).
