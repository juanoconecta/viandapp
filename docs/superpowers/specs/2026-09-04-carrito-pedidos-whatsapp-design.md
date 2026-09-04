# Carrito y pedidos por WhatsApp — Diseño

**Fecha:** 2026-09-04 (segunda revisión correctiva 2026-09-04)
**Estado:** Corregido tras la segunda revisión de Codex sobre el commit
`2ee4acc` — pendiente de una tercera revisión antes de implementar.
Cambios de esta revisión: `crear_pedido_atomico` ahora bloquea
(`FOR UPDATE`) y revalida cocina/disponibilidad/precio **dentro** de la
transacción, en vez de confiar en una lectura previa de la Server Action
(§6); `request_hash` canónico reemplaza la comparación ad-hoc de
contenido para la idempotencia concurrente (§8); `calcularTotal` rechaza
`null`/`NaN`/`Infinity` en runtime, no solo negativos (§13); el limitador
de abuso usa HMAC real (no hash simple), no confía en un `sesionId` libre
como frontera de seguridad, y el límite global pasa a ser un circuito de
emergencia de umbral alto, no un bloqueo rutinario (§7); el cron de
purgado falla cerrado sin secreto y comparte servicio con la limpieza del
limitador (§9); TDD ampliado con los 14 casos pedidos en esta revisión
(§13).
**Depende de:** Envíos y adhesión a Puni (necesita
`vianderas.costo_envio_propio`, `vianderas.cobertura_envio` y una
proyección server-only de `puni_adhesiones` — ver esa spec, corregida en
esta misma revisión para eliminar el acceso directo de la vendedora a la
tabla). Ver "Orden recomendado de implementación" en el reporte final.

## 1. Objetivo

Reemplazar el flujo actual de "consultar por WhatsApp un solo plato"
(`WhatsAppIntent.tsx`) por uno de carrito multi-plato de **una sola
cocina**, que termina igual en WhatsApp — sin pagos online, sin cuenta de
consumidor, sin checkout propio.

## 2. Invariantes no negociables

1. **Una cocina por carrito.** El servidor rechaza cualquier pedido cuyos
   ítems no pertenezcan todos a la misma `vianderas_id`.
2. **Revalidación server-side obligatoria, dentro de la misma transacción
   que la escritura.** No alcanza con que la Server Action lea
   `viandas` antes de llamar a la función que crea el pedido — entre esa
   lectura y el `insert` puede pasar cualquier cosa (otro pedido
   concurrente, la vendedora editando el precio). La función que crea el
   pedido vuelve a leer y **bloquea** (`SELECT ... FOR UPDATE`) las filas
   de `viandas` involucradas, dentro de su propia transacción, y calcula
   todo a partir de esa lectura bloqueada — nunca de lo que la Server
   Action leyó antes de invocarla.
3. **Captura inmutable, calculada por la base, nunca por la aplicación.**
   `nombre_capturado` y `precio_capturado` de cada plato salen de la fila
   de `viandas` que la función bloqueó y leyó — la aplicación puede
   *sugerir* qué cree que vio (para detectar y mostrar cambios), pero
   nunca son valores autoritativos que la función simplemente copie.
4. **Total exacto, calculado por la base.** `total = Σ(precio_capturado ×
   cantidad) + costo_envio_capturado`, calculado dentro de la misma
   función, a partir de los mismos valores bloqueados — nunca un `total`
   que la aplicación envíe y la función solo persista. `null` en el costo
   de envío de una modalidad significa "todavía no hay una tarifa
   utilizable" — esa modalidad queda deshabilitada en el checkout. `0`
   solo significa envío gratuito configurado explícitamente. Precios,
   cantidades y costos se validan en runtime como números finitos — un
   `NaN`, `Infinity` o `null` en cualquiera de estos campos se rechaza
   antes de cualquier operación aritmética, nunca se propaga
   silenciosamente (`100 + null` en JavaScript es `100`, no un error —
   ver §13, este bug concreto ya se encontró y se corrige acá).
5. **Si cambió un precio, el comprador revisa de nuevo.** Nunca se
   recalcula y se sigue en silencio.
6. **Sin pagos online.**
7. **Abrir WhatsApp no es confirmar.** Solo la vendedora, siguiendo
   transiciones válidas (§11), puede marcar el pedido `confirmado` o
   `rechazado`.
8. **Pedido y sus ítems se crean atómicamente, con los datos vigentes
   verificados dentro de la misma transacción que los escribe.** Ver §6.

## 3. Carrito: dónde vive

Sin cambios respecto a la versión anterior: `localStorage`, sin tabla
`carritos` en la base, sin precios ni nombres cacheados server-side antes
de confirmar.

```ts
type CarritoAlmacenado = {
  vianderaId: string;
  items: { platoId: string; cantidad: number }[];
};
```

## 4. Flujo

```
1. Consumidor agrega platos al carrito (localStorage).
2. Abre el carrito → GET server-side de precio/disponibilidad frescos,
   solo para mostrar un resumen razonable — esta lectura es informativa,
   NUNCA la fuente de verdad final (esa vive dentro de la función
   atómica, ver §6).
3. Elige modalidad — solo las que tienen costo de envío resoluble ahora
   mismo (spec de Envíos/Puni).
4. Completa nombre + teléfono + dirección (si aplica).
5. Tilda (opcional, destildado por defecto) consentimiento de marketing.
6. Confirma → Server Action `generarPedido`:
   a. Chequea el limitador de abuso (§7) — si está excedido, corta acá.
   b. Hace una revalidación liviana (no bloqueante) para poder mostrar
      `revisar_carrito` con buena UX sin gastar un viaje a la función
      atómica en el caso común de "todo cambió, avisale al usuario antes
      de intentar nada más pesado".
   c. Si esa revalidación liviana no encuentra cambios, llama a
      `crear_pedido_atomico` (§6), que hace la revalidación **real**
      (bloqueante, autoritativa) y crea el pedido si todo sigue en
      orden, o devuelve qué cambió si no.
   d. Si la función atómica reporta cambios (pudieron ocurrir en la
      ventana entre el paso b y el c, por eso la revalidación de la
      función es la que cuenta) → `revisar_carrito`, sin haber escrito
      nada.
7. Cliente recibe el link `wa.me/...`. El pedido queda `generado`.
8. La vendedora marca `confirmado`/`rechazado` siguiendo transiciones
   válidas (§11).
```

## 5. Modelo de datos

### `pedidos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `idempotency_key` | `uuid` | `unique not null` |
| `request_hash` | `text` | `not null` — huella canónica del pedido solicitado, ver §8 |
| `vianderas_id` | `uuid` | FK `vianderas`, `on delete restrict` |
| `modalidad` | `text` | `check in ('retiro','envio_propio','envio_puni')` |
| `costo_envio_capturado` | `numeric` | `not null default 0 check (>= 0)` |
| `total` | `numeric` | `not null check (>= 0)` — calculado por `crear_pedido_atomico`, nunca aceptado del cliente |
| `estado` | `text` | `check in ('generado','confirmado','rechazado','cancelado')`, default `'generado'` |
| `nombre_comprador` | `text` | Transitorio — ver §9 |
| `telefono_comprador` | `text` | Transitorio |
| `direccion_envio` | `text` | Transitorio |
| `acepta_marketing` | `boolean` | `not null default false` |
| `consentimiento_marketing_en` | `timestamptz` | Nullable |
| `purgar_datos_en` | `timestamptz` | `not null default (now() + interval '90 days')` |
| `datos_purgados` | `boolean` | `not null default false` |
| `created_at` / `updated_at` | `timestamptz` | |

### `pedido_items`

Sin cambios respecto a la versión anterior — `nombre_capturado`,
`precio_capturado`, `cantidad`, `subtotal` (columna generada).

## 6. Pedido realmente atómico

**Corrección central de esta revisión**: en la versión anterior, la
función `crear_pedido_atomico` recibía ítems ya "revalidados por la
Server Action" y solo los persistía — eso deja exactamente la carrera que
todo este diseño quiere evitar (la Server Action lee `viandas`, y *antes*
de que la función inserte, otra transacción concurrente pudo cambiar el
precio o la disponibilidad). La corrección: la función hace la lectura
autoritativa **ella misma**, bloqueando las filas, dentro de su propia
transacción.

**Firma** (conceptual — el plan tiene el SQL completo con tipos exactos):

```
crear_pedido_atomico(
  p_idempotency_key uuid,
  p_vianderas_id uuid,
  p_modalidad text,
  p_costo_envio_esperado numeric,   -- lo que el cliente cree que va a pagar de envío; NO autoritativo
  p_items jsonb,                     -- [{vianda_id, cantidad, precio_esperado}], precio_esperado NO autoritativo
  p_nombre_comprador text,
  p_telefono_comprador text,
  p_direccion_envio text,
  p_acepta_marketing boolean
) returns pedido_resultado             -- tipo compuesto: { ok boolean, pedido pedidos, cambios jsonb }
```

Dentro de la función, en este orden, todo en una sola transacción:

1. **Validar la forma de `p_items`**: array no vacío; `vianda_id` únicos
   (sin repetidos); cada `cantidad` es un entero dentro de un rango
   definido (`1..50` por ítem — número inicial razonable, no una cifra de
   negocio cerrada); si algo de esto falla, la función lanza una
   excepción explícita **antes** de tocar `viandas` — un `p_items`
   malformado no debe ni siquiera intentar bloquear filas.
2. **Bloquear y leer las filas reales**: `select id, nombre, precio,
   disponible from viandas where id = any(<vianda_ids de p_items>) and
   vianderas_id = p_vianderas_id for update`. El filtro por
   `vianderas_id` en la misma query es la verificación de "una sola
   cocina" a nivel de dato (si alguien intenta mezclar IDs de otra
   cocina, esas filas simplemente no vuelven).
3. Si la cantidad de filas devueltas no coincide con la cantidad de
   `vianda_id` distintos pedidos, o alguna tiene `disponible = false`, o
   algún precio leído difiere del `precio_esperado` correspondiente →
   la función arma la lista de `cambios` (mismo vocabulario que
   `detectarCambios`: `plato_no_disponible`, `precio_cambio`) y devuelve
   `{ok: false, cambios: [...]}` **sin insertar nada** — ni `pedidos` ni
   `pedido_items`.
4. Si todo coincide, calcula `precio_capturado`/`nombre_capturado` de
   cada ítem **desde las filas bloqueadas** (nunca desde
   `precio_esperado`), calcula `subtotal` por ítem y `total` como su
   suma más el costo de envío vigente (leído de `vianderas`/
   `puni_adhesiones` dentro de la misma transacción, comparado del mismo
   modo contra `p_costo_envio_esperado` — un costo de envío que cambió
   entre que se abrió el carrito y se confirmó también es un `cambio`
   detectable, no algo que se cuele en el total).
5. Calcula `request_hash` (§8) a partir de los parámetros de entrada
   (canónicos, no de lo calculado).
6. Intenta `insert into pedidos (...) on conflict (idempotency_key) do
   nothing returning *`. Si no insertó (ya existía, sea porque una
   llamada anterior de verdad ya lo creó, o porque una llamada
   concurrente idéntica ganó la carrera mientras esta transacción estaba
   bloqueada esperando el mismo lock de `viandas`), lee la fila existente
   por `idempotency_key` y compara `request_hash`: coincide → devuelve
   esa fila como resultado exitoso (sin insertar `pedido_items` de
   nuevo); no coincide → lanza una excepción distinta
   (`idempotency_key_content_mismatch`).
7. Si insertó, inserta `pedido_items` en la misma transacción y devuelve
   `{ok: true, pedido: <fila>}`.

**Privilegios**: `revoke execute on function
crear_pedido_atomico(uuid, uuid, text, numeric, jsonb, text, text, text,
boolean) from public, anon, authenticated; grant execute on function
crear_pedido_atomico(...) to service_role;` — con la firma de argumentos
completa en el `revoke`/`grant` (Postgres exige el tipo de cada
parámetro para identificar la función sin ambigüedad; un `grant ... on
function nombre` sin firma es SQL inválido o ambiguo si hay más de una
función con ese nombre).

## 7. Limitación de abuso (rate limiting)

Tres capas, ninguna es un sustituto de la idempotencia (§8) — resuelven
problemas distintos.

- **Por origen (IP), la capa que de verdad importa como frontera de
  seguridad.** La IP se pasa por **HMAC-SHA256 con secreto**
  (`RATE_LIMIT_SECRET`, server-only, nunca commiteado) — no una
  concatenación + SHA256 simple (más débil, más susceptible a ciertos
  ataques de diccionario si el secreto se filtra parcialmente). Nunca se
  guarda la IP original.
- **Por sesión, señal secundaria únicamente — nunca la frontera de
  seguridad.** El identificador de sesión lo emite el **servidor** (una
  cookie `httpOnly` con un valor aleatorio, seteada la primera vez que el
  visitante llega a la pantalla de checkout) — no un valor que el
  navegador genere y mande libremente. Aun así, es una señal secundaria:
  alguien puede descartar cookies y obtener una sesión nueva sin mucho
  esfuerzo, así que esta capa existe para dar una mejor experiencia (un
  mensaje de "ya generaste varios pedidos, esperá un rato" atribuible a
  *esa* sesión) pero **rotar este identificador nunca debe alcanzar para
  evadir el límite real**, que es el de IP.
- **Global, como circuito de emergencia, no como bloqueo rutinario.** Un
  umbral bajo acá (el ~100/5min de la revisión anterior) tiene un efecto
  perverso: un puñado de solicitudes maliciosas concentradas
  bloquearían **toda la plataforma** para compradores legítimos — el
  límite global se convierte en la herramienta de un atacante, no una
  defensa. Se sube a un umbral mucho más alto (ej. 1000 cada 5 minutos)
  y se trata como una señal de incidente (alertable, para que alguien lo
  mire) — no como parte del camino normal de rechazo. En operación
  normal, este límite no debería activarse nunca.

**Semántica exacta** (ambigua en la revisión anterior, corregida acá):
con un límite de 5, las primeras 5 solicitudes de esa clave/ventana se
permiten, la 6ª se bloquea. El contador se incrementa en cada intento
(exitoso o no); el chequeo es `intentos_despues_de_incrementar >
limite`, no `>=`.

**Limpieza y retención**: los contadores de ventana vencida no se
acumulan para siempre — un servicio compartido con el purgado de pedidos
(§9) borra filas de `limite_solicitudes` más viejas que su propia
ventana de retención (ej. 7 días — suficiente para cualquier auditoría
razonable de abuso, sin acumular datos indefinidamente). El hash de IP
en sí nunca se convierte en un identificador de largo plazo — su único
propósito es contar intentos en una ventana corta.

## 8. Idempotencia concurrente

`idempotency_key` por sí sola no alcanza cuando dos llamadas
**concurrentes** con la misma key llegan casi al mismo tiempo — hace
falta una forma de comparar "¿es realmente la misma solicitud, o alguien
reutilizó la key con otra cosa?" sin ambigüedad, y sin que el orden de
llegada de dos solicitudes idénticas produzca dos pedidos.

**`request_hash`**: una huella canónica, calculada **dentro** de
`crear_pedido_atomico` (nunca confiada del cliente), a partir de:

- `vianderas_id`
- `modalidad`
- Los ítems, como `{vianda_id, cantidad}`, **ordenados por `vianda_id`**
  — nunca por el `id` de `pedido_items` (esa columna es un UUID
  aleatorio generado recién al insertar; no existe todavía cuando se
  calcula el hash de la solicitud entrante, y aunque existiera, dos
  llamadas idénticas podrían generar UUIDs distintos para "el mismo"
  ítem — no es una clave estable para canonicalizar).
- `nombre_comprador`/`telefono_comprador`/`direccion_envio`,
  normalizados (trim, mismo criterio de normalización que el resto del
  sistema).
- `acepta_marketing`.

**No incluye** precio ni total — esos son lo que el servidor determina,
no lo que el cliente pidió; dos llamadas con el mismo `idempotency_key`
y el mismo pedido solicitado deben considerarse "la misma solicitud"
incluso si el precio cambió entre medio (en cuyo caso, la primera
llamada que logró crear el pedido ya fijó su `precio_capturado`, y la
segunda llamada simplemente recibe esa misma fila — no una nueva con el
precio actualizado).

Comportamiento (ver §6, paso 6):

- **Dos llamadas concurrentes, contenido idéntico** → ambas calculan el
  mismo `request_hash`; una gana la carrera de inserción, la otra la
  detecta por `on conflict` y devuelve la misma fila. Un solo pedido.
- **Misma key, mismo contenido, en **distinto orden** de ítems en el
  array de entrada** → el `request_hash` es el mismo (por el ordenamiento
  canónico por `vianda_id`), así que se trata igual que el caso anterior.
- **Misma key, contenido distinto** (otra dirección, otra modalidad,
  otro costo, otros ítems) → `request_hash` distinto → rechazo
  explícito, nunca sobrescribe el pedido existente.

## 9. Privacidad y retención

Sin cambios de fondo respecto a la versión anterior — 90 días,
`purgar_datos_en`. **Correcciones de esta revisión** (detalle completo en
el plan): el cron falla cerrado si `CRON_SECRET` no está configurado
(nunca autoriza por accidente con un secreto vacío/ausente), revisa el
resultado del `update` y no reporta "purgados" si la escritura falló, y
la lógica de purgado vive en un único servicio compartido entre el cron
y la Server Action manual de `/admin` (no duplicada en dos lugares que
puedan divergir). Ese mismo servicio limpia también los contadores
vencidos de `limite_solicitudes` (§7).

## 10. Generación del mensaje de WhatsApp

Sin cambios respecto a la versión anterior.

## 11. Panel de la vendedora (`/viandera`) y transiciones de `estado`

Sin cambios respecto a la versión anterior — tabla de transiciones,
trigger `pedidos_validar_transicion`, Server Action
`actualizarEstadoPedido`.

## 12. Acceso y RLS

Sin cambios respecto a la versión anterior.

## 13. Cobertura de TDD requerida

Funciones puras:

1. `calcularTotal(items, costoEnvio)` — **corregido en esta revisión**:
   además de los casos ya cubiertos (suma exacta, lista vacía, precio/
   cantidad negativos), rechaza explícitamente `null`, `NaN` e
   `Infinity` en `costoEnvio`, en `precioCapturado`, y en `cantidad` —
   el bug encontrado por la revisión: `100 + null` en JavaScript es
   `100`, no un error, así que la validación previa
   (`item.precioCapturado < 0`) no atrapaba un `null` (`null < 0` es
   `false`). El nuevo test se escribe primero, confirmando que falla
   contra la implementación vieja, antes de corregir con
   `Number.isFinite()` en cada valor. `0` sigue siendo válido en
   cualquiera de los tres campos.
2. `detectarCambios`, `validarUnaSolaCocina`, `construirMensajePedido`,
   `resolverModalidadesDisponibles`, `transicionValidaPedido` — sin
   cambios respecto a la versión anterior.
6. `debeLimitar(intentos, limite)` — **corregido**: semántica exacta de
   §7 (`intentos > limite`, no `>=`) — con un límite de 5, el test
   confirma que `debeLimitar(5, 5)` es `false` (la 5ª solicitud se
   permite) y `debeLimitar(6, 5)` es `true` (la 6ª se bloquea).
7. `hmacIp(ip, secreto)` — determinístico, nunca contiene la IP original
   en el resultado, dos IPs distintas producen hashes distintos, la
   misma IP con secretos distintos también (para poder rotar el secreto
   sin colisiones accidentales).

Tests de integración (contra Postgres real — ver plan, Task 0, incluida
la resolución del bloqueo de infraestructura):

8. **Dos llamadas concurrentes con la misma `idempotency_key` y
   contenido idéntico crean una sola orden** — disparadas realmente en
   paralelo (no secuencialmente con un mock), verificando que
   `pedido_items` tiene exactamente la cantidad de filas de un pedido,
   no el doble.
9. **Misma key, mismo contenido, ítems en distinto orden** → mismo
   `request_hash`, mismo pedido devuelto.
10. **Misma key con dirección, modalidad o costo distintos** → rechazo
    explícito.
11. **Cambio de precio concurrente detectado dentro de la transacción**:
    una transacción bloqueada, mientras espera, tiene su fila de
    `viandas` modificada por otra sesión antes de que la primera
    obtenga el lock — al obtenerlo, ve el precio nuevo y lo reporta como
    cambio (o lo usa como capturado, según corresponda al orden real de
    commits) — este es el test que confirma que la corrección de §6
    (validar dentro de la transacción, no antes) efectivamente cierra la
    carrera.
12. **El total en la base coincide exactamente con la suma de
    `pedido_items.subtotal` más `costo_envio_capturado`** — verificado
    leyendo la fila insertada, no solo confiando en el valor devuelto
    por la función.
13. **Array de ítems vacío, ítem duplicado (mismo `vianda_id` dos
    veces), y cantidad fuera de rango** — los tres rechazados por la
    función antes de bloquear ninguna fila de `viandas`.
14. **`null`/`NaN`/`Infinity` rechazados en runtime** — ver punto 1.
15. **Sexta solicitud bloqueada cuando el límite es 5** — ver punto 6,
    ahora como test de integración contra la tabla real de contadores
    (no solo la función pura `debeLimitar`).
16. **Rotar el identificador de sesión (cookie) no evade el límite
    real** — generar una request con una sesión nueva pero la misma IP
    (hasheada) ya en el límite, confirmar que sigue bloqueada por la
    capa de IP aunque la capa de sesión esté en cero.
17. **El cron sin `CRON_SECRET` configurado rechaza** (falla cerrado,
    no autoriza por ausencia de secreto).
18. **Un fallo en la escritura del purgado devuelve error y no informa
    éxito** — mockear/forzar un error en el `update` del servicio de
    purgado y confirmar que la respuesta refleja el fallo, no
    `purgados: N` con `N > 0`.
19. **Imposibilidad de leer `nota_admin` públicamente** — ver spec de
    Envíos/Puni (corregida en esta revisión: ni siquiera la vendedora
    lee la tabla directo).

## 14. Fuera de alcance de esta entrega

Sin cambios respecto a la versión anterior.
