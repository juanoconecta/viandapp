# Carrito y pedidos por WhatsApp — Diseño

**Fecha:** 2026-09-04 (revisión correctiva 2026-09-04)
**Estado:** Corregido tras revisión de Codex sobre el commit `4196de3` —
pendiente de una segunda revisión antes de implementar. Cambios de esta
revisión: creación atómica del pedido (§6), limitador de abuso (§7,
nueva), costo `null` deshabilita la modalidad en vez de convertirse en
`0`/"a coordinar" (§5, §9), transiciones de `pedidos.estado` validadas
explícitamente (§10), idempotencia sobrevive a un refresh de pantalla y
verifica contenido (§8), cobertura de TDD ampliada (§12).
**Depende de:** Envíos y adhesión a Puni (necesita
`vianderas.costo_envio_propio`, `vianderas.cobertura_envio` y una
proyección server-only de `puni_adhesiones` para calcular costo de envío
y ofrecer la modalidad Puni — la vendedora configura el costo de Puni
ella misma una vez aprobada, ver esa spec §3). Ver "Orden recomendado de
implementación" en el reporte final.

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
   Sin redondeos ocultos, sin cargos no declarados. `null` en el costo de
   envío de una modalidad significa "todavía no hay una tarifa utilizable"
   — esa modalidad queda **deshabilitada** en el checkout, nunca se
   convierte en `0` ni en "a coordinar" dentro de un pedido. `0` solo
   significa envío gratuito configurado explícitamente por la vendedora.
   Un pedido con total "aproximado" no es un pedido con total exacto.
5. **Si cambió un precio, el comprador revisa de nuevo.** Nunca se
   recalcula y se sigue en silencio — se muestra qué cambió y se pide
   confirmación explícita.
6. **Sin pagos online.** Ningún campo de tarjeta, ningún gateway. El pedido
   termina en un link de WhatsApp.
7. **Abrir WhatsApp no es confirmar.** El estado inicial del pedido
   (`generado`) no significa que el mensaje se envió ni que la vendedora lo
   vio. Solo la vendedora, manualmente desde `/viandera`, puede marcarlo
   `confirmado` o `rechazado` después de hablar con la compradora — y solo
   siguiendo transiciones válidas (§10), nunca a cualquier valor del enum.
8. **Pedido y sus ítems se crean atómicamente.** Una única función
   transaccional de Postgres inserta `pedidos` + `pedido_items` — nunca
   una secuencia de llamadas desde la Server Action que pueda dejar un
   pedido sin ítems si falla a mitad de camino.

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
3. Elige modalidad: solo se muestran las que tienen un costo de envío
   resoluble ahora mismo — retiro (siempre `0`), envío propio (solo si
   `costo_envio_propio` no es `null`), envío Puni (solo si la adhesión
   está `aprobada` **y** la vendedora ya configuró su costo, ver spec de
   Envíos/Puni §3-4).
4. Completa nombre + teléfono (obligatorios para coordinar) y dirección
   (obligatoria solo si la modalidad es de envío).
5. Tilda (opcional, sin marcar por defecto) "Quiero que me avisen de nuevas
   cocinas" — consentimiento de marketing, separado del envío del pedido.
6. Confirma → Server Action `generarPedido`:
   a. Chequea el limitador de abuso (§7) — si está excedido, corta acá sin
      tocar nada más.
   b. Revalida disponibilidad y precio de cada ítem, y que la modalidad
      elegida siga teniendo un costo resoluble.
   c. Si algo cambió → responde `revisar_carrito` con el detalle, sin crear nada.
   d. Si todo coincide → llama la función transaccional `crear_pedido_atomico`
      (§6) con el `idempotency_key` persistido en `sessionStorage` (§8), que
      inserta `pedidos` + `pedido_items` en una sola transacción, calcula el
      total server-side, y arma el mensaje de WhatsApp.
7. Cliente recibe el link `wa.me/...` y lo abre. El pedido queda en estado
   `generado`. El carrito (y la `idempotency_key` en `sessionStorage`) se
   limpian recién acá.
8. La vendedora, desde /viandera, ve el pedido y lo marca `confirmado` o
   `rechazado` siguiendo las transiciones válidas de §10, después de
   coordinar por WhatsApp.
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
| `purgar_datos_en` | `timestamptz` | `not null default (now() + interval '90 days')` — 90 días, confirmado (ver §9) |
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

`pedidos.total` se calcula **dentro** de la función transaccional (§6) a
partir de los mismos ítems que se insertan — no hay una ventana entre
"calcular" e "insertar" donde algo pueda desincronizarse.

## 6. Pedido atómico

`pedidos` y `pedido_items` se crean **exclusivamente** dentro de una
función de Postgres (`crear_pedido_atomico`, `language plpgsql`) que hace
todos los inserts en una sola transacción — nunca una secuencia de
llamadas separadas desde la Server Action. Si el insert de `pedido_items`
fallara (constraint violado, dato inesperado), la transacción entera hace
rollback: no queda un `pedidos` huérfano sin ítems.

La función:

- Recibe `idempotency_key`, los datos del pedido, y los ítems como
  parámetros (los ítems como `jsonb`, ya revalidados por la Server Action
  antes de llamarla — la función no vuelve a consultar `viandas`, esa
  responsabilidad es de la Server Action, que sí tiene acceso de lectura
  ordinario; la función solo persiste lo que ya se validó).
- Si `idempotency_key` ya existe: compara el contenido (ítems + total +
  modalidad) contra lo guardado. Si coincide, devuelve el pedido existente
  sin volver a insertar nada. Si **no** coincide, rechaza explícitamente
  (§8) — nunca "actualiza silenciosamente" un pedido ya creado con
  contenido distinto.
- Si no existe, inserta `pedidos` y sus `pedido_items` en la misma
  transacción y devuelve la fila creada.

Privilegios: `revoke execute on function crear_pedido_atomico from
public, anon, authenticated; grant execute ... to service_role;` — la
única forma de invocarla es desde `createAdminClient()` en la Server
Action, después de toda la revalidación. Nadie más puede ejecutarla ni
aunque conociera su firma.

## 7. Limitación de abuso (rate limiting)

La idempotencia (§8) evita duplicados **accidentales** (doble-click,
reintento de red) — no evita que alguien genere pedidos falsos en
volumen. `generarPedido` chequea un límite **antes** de cualquier
revalidación o escritura:

- **Global**: máximo de pedidos creados en toda la app dentro de una
  ventana corta (ej. 100 cada 5 minutos — número inicial, ajustable, no
  una cifra de negocio confirmada).
- **Por sesión de checkout**: el cliente ya trae un `idempotency_key`
  guardado en `sessionStorage` (§8); se deriva de ahí (o de un token de
  sesión separado, a definir en el plan) una clave para limitar cuántos
  pedidos puede intentar generar la misma sesión de navegador en una
  ventana corta (ej. 5 cada hora).
- **Por origen (IP)**: como segunda capa, para que limpiar
  `sessionStorage` no sea una forma trivial de eludir el límite anterior.
  **Nunca se guarda la IP en texto plano** — se guarda un hash
  (`sha256(ip || salt)`, con `salt` un secreto server-only en variable de
  entorno, nunca commiteado) como clave de un contador de ventana fija.

Diseño: una tabla de contadores por clave+ventana (ver plan para el
schema), con un incremento atómico (`insert ... on conflict (clave,
ventana) do update set intentos = intentos + 1 returning intentos`) para
que el chequeo no tenga una condición de carrera entre leer y escribir.
Si cualquiera de las tres capas está excedida, `generarPedido` devuelve
un error genérico (sin distinguir cuál capa fue, para no dar información
útil a quien esté abusando) y no toca `pedidos` en absoluto.

## 8. Idempotencia

El cliente genera un `idempotency_key` (UUID v4) **una sola vez**, en el
momento en que se abre la pantalla de confirmación del carrito, y lo
guarda en `sessionStorage` (no `localStorage`: no debe sobrevivir a
cerrar la pestaña, pero sí debe **sobrevivir a un refresh de la
pantalla de checkout** — si el comprador recarga por error o por un
timeout de red, debe poder reintentar con la misma key en vez de generar
un pedido nuevo). La key se conserva hasta que:

- el pedido se completa (`generarPedido` devuelve `ok`) — se limpia junto
  con el carrito, o
- el carrito cambia materialmente (se agrega/quita un ítem, cambia una
  cantidad) — en ese caso el cliente **regenera** la key, porque es una
  intención de compra distinta.

`crear_pedido_atomico` (§6) es quien de verdad garantiza la idempotencia
a nivel de dato: si `idempotency_key` ya existe, compara el contenido
recibido contra lo guardado.

- **Contenido igual** → devuelve el pedido existente, no inserta nada
  nuevo (reintento legítimo: doble-click, refresh, reintento de red).
- **Contenido distinto** → rechaza explícitamente. Esto solo puede pasar
  si el cliente reutilizó una key vieja con un carrito distinto (un caso
  que el diseño del cliente ya evita regenerando la key al cambiar el
  carrito, pero el servidor no confía en que el cliente se porte bien —
  es la misma disciplina que el resto de esta spec).

Un doble-click, un reintento de red, o un refresh de la pantalla de
confirmación nunca generan dos pedidos ni corrompen uno existente.

## 9. Privacidad: minimización de datos del comprador

- `nombre_comprador`, `telefono_comprador`, `direccion_envio` se guardan
  porque la vendedora los necesita para coordinar (y porque el pedido en
  `/viandera` es más útil con contexto) — pero no indefinidamente.
- **Retención fijada en 90 días** (decisión cerrada en esta revisión, ya
  no una propuesta). `purgar_datos_en = created_at + 90 días`.
- El purgado no puede depender únicamente de que el admin recuerde
  apretar un botón. Mecanismo primario: un **Vercel Cron Job**
  (`vercel.json` → `crons`, corre diario) que pega a una Route Handler
  protegida (`Authorization: Bearer $CRON_SECRET`) que ejecuta el
  purgado vía `createAdminClient()`. Una Server Action manual desde
  `/admin` queda como respaldo/gatillo inmediato, no como el mecanismo
  principal. **Gate de publicación**: esta entrega no se considera lista
  para producción hasta confirmar que el cron corre — ver checklist de
  seguridad del plan.
- El purgado nullea `nombre_comprador`/`telefono_comprador`/
  `direccion_envio` y marca `datos_purgados = true`. El resto del pedido
  (ítems, total, modalidad, fechas, estado) **no se borra** — sigue
  siendo el historial de ventas de la vendedora y la base del CRM.
- El consentimiento de marketing (`acepta_marketing`) es independiente:
  aceptar el pedido nunca implica aceptar marketing, y el checkbox
  correspondiente arranca **destildado**. Ver spec de CRM §3/§9 para cómo
  el consentimiento de marketing (no el pedido en sí) es lo que
  determina si un comprador conserva una ficha de CRM más allá de la
  ventana de retención de 90 días.

## 10. Generación del mensaje de WhatsApp

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

## 11. Panel de la vendedora (`/viandera`) y transiciones de `estado`

Nueva sección (no reemplaza nada existente) para listar pedidos recibidos:
fecha, cliente, ítems, total, modalidad, estado. Sin edición de montos ni
ítems desde acá — un pedido ya generado es inmutable en su contenido,
solo su `estado` cambia, y **no a cualquier valor del enum**:

| Desde | Hacia | Quién |
|---|---|---|
| `generado` | `confirmado` | Vendedora |
| `generado` | `rechazado` | Vendedora |
| cualquiera | `cancelado` | Reservado para uso futuro/admin — no se dispara desde la vendedora en esta entrega |

Cualquier otra transición (ej. `confirmado` → `generado`, `rechazado` →
`confirmado`) se rechaza. La mutación pasa por una Server Action
(`actualizarEstadoPedido`) que autentica que el pedido pertenece a la
vendedora **y** valida la transición contra esta tabla antes de escribir
— la RLS (§12) es la red de seguridad, no el único control.

## 12. Acceso y RLS

- `pedidos`/`pedido_items`: RLS habilitado.
  - **Sin policy de insert para `anon`/`authenticated`** — todo insert pasa
    por `generarPedido` (Server Action) usando `createAdminClient()`
    después de revalidar todo. El comprador nunca escribe directo a la
    tabla.
  - Policy de select para la vendedora: `vianderas_id in (select id from
    vianderas where user_id = auth.uid())`.
  - Policy de update para la vendedora: un trigger
    `pedidos_validar_transicion()` rechaza, para cualquier sesión sin
    service role, (a) cualquier cambio a `total`, `costo_envio_capturado`,
    `nombre_comprador`, `telefono_comprador`, `direccion_envio`,
    `vianderas_id` o `idempotency_key`, y (b) cualquier `(old.estado,
    new.estado)` que no esté en la tabla de §11 — la vendedora nunca
    tiene un `UPDATE` general sobre la tabla, ni siquiera limitado a
    `estado`, sino uno cuyo contenido válido está acotado por trigger.
  - `pedido_items` no tiene policy de update en absoluto para
    `authenticated` (son inmutables una vez creados) — la vendedora los
    lee vía la policy de select de `pedidos` (join).

## 13. Cobertura de TDD requerida

Funciones puras, sin I/O, testeadas antes de integrarlas:

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
   pieza de contenido obligatorio de §10 (aparece el total, aparece cada
   ítem, aparece el costo de envío solo si `costoEnvio > 0`, nunca aparece
   el teléfono del comprador).
5. `resolverModalidadesDisponibles(viandera, adhesionPuni)` — reexporta
   `modalidadesDisponibles`/`costoEnvioVigente` de la spec de Envíos/Puni
   §9: **una modalidad con costo `null` no aparece en el resultado**
   (retiro siempre disponible con costo `0`; envío propio solo si
   `costo_envio_propio` no es `null`; Puni solo si `estado === 'aprobada'`
   **y** la vendedora ya cargó su costo).
6. `transicionValidaPedido(desde, hacia)` — un test por cada fila de la
   tabla de §11, más casos explícitamente rechazados (`confirmado` →
   `generado`, `rechazado` → `confirmado`, cualquier valor hacia sí
   mismo).
7. **Atomicidad de `crear_pedido_atomico`** (test de integración contra
   una base de test real, no un mock — ver plan): un pedido con 2+ ítems
   se crea con todas sus filas o ninguna; forzar un fallo a mitad de
   camino (ej. un ítem con `cantidad` inválida que pasa la validación de
   la Server Action pero no el `check` de la tabla) y confirmar que
   **no queda ningún `pedidos` residual sin ítems**.
8. **Reutilización de `idempotency_key`** con el mismo contenido devuelve
   el mismo pedido sin insertar filas nuevas; con contenido **distinto**
   rechaza explícitamente en vez de sobrescribir.
9. **Limitador de abuso**: excede el límite por sesión → rechaza sin
   tocar `pedidos`; excede el límite global → rechaza; una sesión nueva
   con el límite por sesión no excedido pero el global sí, también
   rechaza (el global es un techo duro, no se elude teniendo cupo
   individual).
10. **Costo `null` bloqueado, costo `0` válido**: un test explícito de
    que una modalidad con costo `null` nunca llega a `calcularTotal` (se
    filtra antes, en `resolverModalidadesDisponibles`), y que un costo
    `0` configurado explícitamente sí se acepta y se suma como `0` sin
    error ni advertencia.
11. **Imposibilidad de leer `nota_admin` públicamente**: test de
    integración (o de la función/consulta server-only, ver spec de
    Envíos/Puni §5) que confirma que ninguna consulta accesible desde
    `anon`/`authenticated` puede recuperar `nota_admin`, `resuelto_por`
    ni ninguna columna de auditoría de `puni_adhesiones`.

## 14. Fuera de alcance de esta entrega

- Pagos online de cualquier tipo.
- Notificaciones push/email al vendedor (se entera por WhatsApp, que es
  justamente el canal).
- Edición de un pedido ya generado por parte del comprador.
- Multi-cocina en un solo pedido.
- Cancelación automática por timeout (el estado `cancelado` existe en el
  enum para uso futuro/manual, no se dispara solo en esta entrega).
