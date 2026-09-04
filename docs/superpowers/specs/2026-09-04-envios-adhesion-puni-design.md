# Configuración de envíos y adhesión a Puni — Diseño

**Fecha:** 2026-09-04 (segunda revisión correctiva 2026-09-04)
**Estado:** Corregido tras la segunda revisión de Codex sobre el commit
`2ee4acc` — pendiente de una tercera revisión antes de implementar.
Cambio de esta revisión: `puni_adhesiones` pasa de "RLS con policies
para que la vendedora vea/edite su propia fila" a **RLS habilitado sin
ninguna policy, para nadie** — ni siquiera la vendedora tiene acceso
directo de tabla. Todo acceso (lectura de su propio estado, solicitud,
re-solicitud, actualización de costo) pasa por Server Actions que
verifican propiedad en código y usan `createAdminClient()` con
proyecciones de columnas estrictamente necesarias (§5, §6).
**Depende de:** nada técnicamente. Es prerequisito de Carrito y pedidos.

## 1. Objetivo

Sin cambios respecto a la versión anterior.

## 2. Invariante central

> "El vendedor no puede autodeclararse adherido... el administrador de
> ViandApp... es el único que puede aprobar, rechazar, suspender o revocar
> la adhesión."

**Corregido en esta revisión**: ya no se refuerza con RLS + trigger sobre
un acceso directo de la vendedora a la tabla — se refuerza con una única
capa, más simple y más fácil de auditar: **`puni_adhesiones` no tiene
ninguna vía de acceso directo desde `anon` ni `authenticated`, para nada,
ni siquiera para su propia fila.** Toda operación (leer su estado,
solicitar, re-solicitar, actualizar costo) pasa por una Server Action que:

1. Autentica al usuario (`createClient()` + `auth.getUser()`).
2. Resuelve su `vianderaId` (`select id from vianderas where user_id =
   auth.uid()`).
3. Verifica que la fila de `puni_adhesiones` que va a tocar (leer o
   escribir) pertenece a **ese** `vianderaId` — nunca confía en un ID
   que el cliente mande.
4. Recién ahí usa `createAdminClient()` para la operación real, con una
   proyección de columnas explícita.

Las transiciones de admin siguen el mismo patrón que ya usaba
`invitarViandera`. La diferencia de esta revisión es que **ahora el
mismo patrón aplica también al camino de la vendedora** — antes tenía
una vía RLS directa (más superficie, más difícil de auditar que
"exactamente qué columnas devuelve esta función"), ahora no.

## 3. Modelo de datos

### Extensión de `vianderas`

Sin cambios: `costo_envio_propio numeric` (nullable, `null` = sin tarifa
cargada = no disponible en el checkout), `cobertura_envio text`.

### `puni_adhesiones`

Sin cambios de columnas respecto a la versión anterior — `estado`,
`costo_envio_puni`, `solicitado_en`, `resuelto_en`, `resuelto_por`,
`nota_admin`, timestamps, `unique (viandera_id)`.

## 4. Transiciones de estado válidas

Sin cambios respecto a la versión anterior — misma tabla, mismo
razonamiento (admin resuelve el estado, vendedora configura el costo por
separado mientras está aprobada).

## 5. Qué se muestra públicamente y qué se muestra a la propia vendedora

Dos superficies de lectura distintas, ambas server-only, ninguna vía RLS:

### Pública (badge, carrito)

```ts
// lib/envios/adhesionPublica.ts
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

Dos conceptos separados, sin cambios respecto a la versión anterior:

1. **Insignia** "Adherido a Puni" — visible con solo `estado = 'aprobada'`.
2. **Modalidad de carrito** "Envío mediante Puni" — visible solo si
   además hay `costo_envio_puni` cargado.

### Propia vendedora (su estado, su motivo de rechazo si lo hay)

**Corregido en esta revisión**: ya no es una policy de RLS de "select su
propia fila" (eso exponía `nota_admin`/`resuelto_por`/`resuelto_en` vía
un camino de acceso de tabla completo, aunque limitado a esa fila —
sigue siendo más superficie de la necesaria). En cambio, una función
server-only con columnas explícitas, invocada desde una Server Action
que ya verificó que la fila pertenece al usuario autenticado:

```ts
// lib/envios/adhesionPropia.ts
export type EstadoAdhesionVendedora = {
  estado: EstadoAdhesionPuni;
  costoEnvioPuni: number | null;
  notaAdmin: string | null; // sí incluida: es legítimo que sepa por qué la rechazaron
  // resuelto_por / resuelto_en NUNCA incluidos: son metadata de auditoría
  // interna (qué admin, cuándo) sin utilidad para la vendedora.
};

export async function obtenerAdhesionPropia(
  vianderaId: string,
): Promise<EstadoAdhesionVendedora | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("puni_adhesiones")
    .select("estado, costo_envio_puni, nota_admin")
    .eq("viandera_id", vianderaId)
    .maybeSingle();
  if (!data) return null;
  return {
    estado: data.estado,
    costoEnvioPuni: data.costo_envio_puni,
    notaAdmin: data.nota_admin,
  };
}
```

`vianderaId` acá **siempre** viene de una Server Action que ya lo
resolvió a partir de `auth.uid()` — esta función nunca se expone
directamente a una ruta pública ni recibe un `vianderaId` sin verificar
de quién es.

## 6. Acceso y RLS

```sql
alter table public.puni_adhesiones enable row level security;
-- Sin ninguna policy. Cero acceso directo para anon/authenticated,
-- incluida la propia vendedora. Todo pasa por Server Actions con
-- createAdminClient() + verificación de propiedad en código (§2, §7).
```

Como no hay ningún camino de escritura directa de la vendedora, **el
trigger de validación de update de la revisión anterior
(`puni_adhesiones_validar_update_vendedora`) ya no es necesario** — se
elimina. La validación de "qué puede cambiar la vendedora" vive
enteramente en las Server Actions del §7 (código de aplicación, más
fácil de leer y de testear que un trigger, y de todos modos es la única
puerta posible ahora que no hay RLS que bypasear).

## 7. Server Actions de la vendedora (reemplazan el acceso directo)

Todas en `app/viandera/actions.ts`, todas empiezan igual: autenticar,
resolver `vianderaId` propio, y recién ahí usar `createAdminClient()`.

- **`obtenerEstadoAdhesionPropia()`** — llama `obtenerAdhesionPropia`
  (§5) con el `vianderaId` ya resuelto del usuario autenticado. Usada
  por `/viandera/perfil` para renderizar la sección "Envío mediante
  Puni".
- **`solicitarAdhesionPuni()`** — inserta (si no existe fila) o actualiza
  a `pendiente` (si existe y está en `rechazada`/`revocada`) usando
  `createAdminClient()`, después de que el código ya validó la
  transición con `transicionValida(estadoActual, 'pendiente',
  'viandera')` — el chequeo de transición vive en código de aplicación,
  no en RLS/trigger.
- **`actualizarCostoEnvioPuni(costo)`** — verifica en código que
  `estado === 'aprobada'` antes de escribir; si no, error sin tocar la
  base.

Ninguna de estas tres acepta un `vianderaId` como parámetro del cliente
— siempre lo resuelven ellas mismas del usuario autenticado, así que no
hay forma de que una vendedora, manipulando el request, opere sobre la
fila de otra.

## 8. Panel de vendedora (`/viandera/perfil`)

Sin cambios de contenido respecto a la versión anterior — toggles de
retiro/envío propio, sección "Envío mediante Puni" con el campo editable
de costo una vez aprobada. **Corregido**: la página ya no lee
`puni_adhesiones` vía un cliente Supabase autenticado con RLS — llama a
`obtenerEstadoAdhesionPropia()` (Server Action, §7).

## 9. Panel de admin (`/admin`)

Sin cambios respecto a la versión anterior — el admin sigue usando
`createAdminClient()` directamente (ya tenía ese patrón, no cambia).

## 10. Cobertura de TDD requerida

1. `transicionValida(desde, hacia, quien)` — sin cambios.
2. `modalidadesDisponibles`/`costoEnvioVigente` — sin cambios respecto a
   la versión anterior (ya cubrían costo `null` deshabilitando la
   modalidad).
3. **Imposibilidad de autohabilitar Puni** (test de integración): con la
   `anon key`, y también con la `authenticated` key de una sesión de
   vendedora real, **cualquier** `update`/`insert` directo contra
   `puni_adhesiones` debe fallar — no hay ninguna policy que lo permita,
   así que el test confirma ausencia total de acceso, no un caso límite
   de una policy.
4. **Imposibilidad de leer `puni_adhesiones` directamente** (test de
   integración, ampliado respecto a la versión anterior): ni `anon` ni
   `authenticated` (incluida la propia vendedora dueña de la fila) puede
   hacer un `select` directo contra la tabla — toda lectura pasa por
   `obtenerAdhesionPropia`/`adhesionesAprobadas`, ambas server-only.
5. `obtenerAdhesionPropia` — test de que el objeto devuelto nunca tiene
   una clave `resuelto_por` ni `resuelto_en` (recorrer `Object.keys` del
   resultado y comparar contra el set exacto esperado, para que un
   cambio futuro del `select` que agregue una columna de más rompa este
   test explícitamente).
6. `actualizarCostoEnvioPuni` — rechaza si `estado !== 'aprobada'`,
   verificado en código, antes de cualquier intento de escritura.

## 11. Fuera de alcance de esta entrega

Sin cambios respecto a la versión anterior.
