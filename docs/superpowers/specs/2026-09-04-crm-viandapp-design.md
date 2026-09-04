# CRM general de ViandApp — Diseño

**Fecha:** 2026-09-04 (segunda revisión correctiva 2026-09-04)
**Estado:** Corregido tras la segunda revisión de Codex sobre el commit
`2ee4acc` — pendiente de una tercera revisión antes de implementar.
Cambios de esta revisión: interesados de la landing y cocinas activas se
sincronizan **automática e idempotentemente** (ya no manual, §6);
deduplicación de consumidores por **contacto normalizado** (teléfono
internacional o email), no por texto crudo (§3, §9); **retiro de
consentimiento** con exclusión inmediata y posibilidad de anonimizar PII
conservando solo relaciones operativas (§9, nueva sección); confirmado
explícitamente que un pedido sin consentimiento **nunca** puede
convertirse manualmente en ficha comercial durable (§6, corrige un
permiso que la revisión anterior sí dejaba abierto).
**Depende de:** nada técnicamente, pero se implementa último. El trigger
que auto-vincula un pedido consentido, y los triggers nuevos sobre
`interesados_viandera`/`vianderas`, se agregan sobre esas tablas ya
existentes desde la migración de CRM — ningún otro plan necesita saber
que el CRM existe.

## 1. Objetivo

Sin cambios respecto a la versión anterior.

## 2. Principio rector: vínculo, no copia — con una excepción explícita y ahora revocable

Sin cambios de fondo respecto a la versión anterior — cada
`crm_contactos` referencia como máximo una tabla especializada, o guarda
`nombre_libre` si no hay ninguna. La excepción de consumidores con
consentimiento de marketing (copia durable) se mantiene, **pero ahora es
revocable** — ver §9.

## 3. Modelo de datos

### `crm_contactos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `tipo` | `text` | `check in ('cocina_potencial','cocina_activa','consumidor','aliado_estrategico','otro')` |
| `viandera_id` | `uuid` | FK a `vianderas`, nullable |
| `interesado_id` | `uuid` | FK a `interesados_viandera`, nullable |
| `nombre_libre` | `text` | Obligatorio si no hay `viandera_id`/`interesado_id` |
| `contacto_libre` | `text` | Teléfono/email libre tal como se ingresó — **valor de exhibición**, no el usado para deduplicar |
| `contacto_normalizado` | `text` | **Nueva en esta revisión** — `generated always as (public.crm_normalizar_contacto(tipo, contacto_libre)) stored`. Es la columna que se usa para deduplicar (§9), nunca `contacto_libre` crudo. |
| `fuente` | `text` | `check in ('landing_interes','explorador','pedido','referido','contacto_directo','otro')` |
| `estado` | `text` | `check in ('nuevo','en_conversacion','calificado','activo','inactivo','descartado')` |
| `etiquetas` | `text[]` | Libres |
| `consentimiento_retirado_en` | `timestamptz` | **Nueva en esta revisión** — nullable; no-nulo excluye inmediatamente al contacto de cualquier acción comercial (§9) |
| `pii_eliminada` | `boolean` | **Nueva en esta revisión** — `not null default false`; `true` cuando el admin anonimizó `nombre_libre`/`contacto_libre` (§9) |
| `created_at` / `updated_at` | `timestamptz` | |

Constraints: sin cambios respecto a la versión anterior
(`crm_contactos_un_solo_vinculo`, `crm_contactos_libre_o_vinculado`).

### `crm_contacto_pedidos`

Sin cambios respecto a la versión anterior — tabla puente, PK compuesta
como garantía de idempotencia.

### `crm_notas`, `crm_tareas`, `crm_interacciones`

Sin cambios.

## 4. Acceso y RLS

Sin cambios — 100% admin-only, RLS habilitado, cero policies en las
cinco tablas.

## 5. Vistas de lectura para la UI del panel

Sin cambios de fondo respecto a la versión anterior —
`crm_contactos_resumen` con el mismo `coalesce`. **Ajuste**: la vista
también expone `consentimiento_retirado_en` y `pii_eliminada`, para que
la UI pueda mostrar claramente el estado de consentimiento de cada
contacto sin una consulta aparte.

## 6. Altas al CRM

### Interesados de la landing y cocinas activas: automáticas e idempotentes

**Corregido en esta revisión** — revierte la decisión "manual, botón
'Agregar a CRM'" de la versión anterior. Ambas fuentes se sincronizan
solas, vía trigger, en el momento en que la fila especializada se crea:

```sql
create or replace function public.crm_sincronizar_interesado()
returns trigger language plpgsql as $$
begin
  insert into public.crm_contactos (tipo, interesado_id, fuente, estado)
  values ('cocina_potencial', new.id, 'landing_interes', 'nuevo')
  on conflict (interesado_id) where interesado_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists crm_sincronizar_interesado_trigger on public.interesados_viandera;
create trigger crm_sincronizar_interesado_trigger
after insert on public.interesados_viandera
for each row execute function public.crm_sincronizar_interesado();

create or replace function public.crm_sincronizar_viandera()
returns trigger language plpgsql as $$
begin
  insert into public.crm_contactos (tipo, viandera_id, fuente, estado)
  values ('cocina_activa', new.id, 'contacto_directo', 'nuevo')
  on conflict (viandera_id) where viandera_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists crm_sincronizar_viandera_trigger on public.vianderas;
create trigger crm_sincronizar_viandera_trigger
after insert on public.vianderas
for each row execute function public.crm_sincronizar_viandera();
```

`on conflict ... do nothing` sobre el índice único parcial ya existente
es la idempotencia: una fila que ya tiene su contacto vinculado (por
ejemplo, si se re-ejecuta el trigger en un escenario de prueba, o si el
admin la había vinculado manualmente antes de que este trigger
existiera) no genera una segunda.

Por qué el cambio de decisión respecto a la versión anterior: la razón
original ("automatizarlo genera ruido en la fase de validación de
mercado") sigue siendo válida como preocupación de UX, pero la revisión
prioriza que el CRM sea una fuente de verdad **completa** — un admin que
tiene que acordarse de un botón para cada lead nuevo es exactamente el
tipo de dependencia frágil que un CRM debería eliminar. El "ruido" se
maneja filtrando por `estado` en el panel (los nuevos entran en
`'nuevo'`, no exigen atención inmediata), no dejando de sincronizar.

### Consumidores: automático, condicionado a consentimiento de marketing — nunca manual sin consentimiento

Sin cambios de mecanismo respecto a la versión anterior (trigger sobre
`pedidos`, disparado solo por `acepta_marketing = true`, ver §9) —
**corrección explícita de esta revisión**: la versión anterior dejaba
abierta una vía manual para que el admin vinculara un pedido sin
consentimiento y opcionalmente copiara el nombre de todos modos
(`copiarNombre: boolean`). **Esa vía se elimina.** Un pedido sin
`acepta_marketing = true`:

- Puede vincularse manualmente a un `crm_contactos` (vía
  `crm_contacto_pedidos`) para trazabilidad operativa — ej. el admin
  quiere anotar que cierto contacto ya existente (un `interesado` que
  también compró) hizo tal pedido.
- **Nunca** puede generar `nombre_libre`/`contacto_libre` durables por
  esa vía — ni con un flag opcional, ni de ninguna otra forma. Si el
  admin necesita ese nombre/contacto más allá de la ventana de retención
  de `pedidos`, la única vía legítima es que el consumidor dé
  consentimiento de marketing en un pedido futuro.

## 7. Fuera de alcance de esta entrega

Sin cambios respecto a la versión anterior.

## 8. Checklist de seguridad y privacidad

- RLS habilitado en las 5 tablas, cero policies.
- Ninguna Server Action de CRM ejecuta sin `esAdmin()`.
- Copia durable de PII solo con base legal explícita (consentimiento de
  marketing), y ahora **revocable** (§9).
- `crm_notas.texto`/`crm_interacciones.resumen`: advertencia en la UI.
- **Nuevo en esta revisión**: un contacto con `consentimiento_retirado_en`
  no-nulo queda excluido de inmediato de cualquier acción comercial —
  verificado explícitamente en cada Server Action que envíe o programe
  algo hacia un contacto (aunque esta entrega no tiene todavía ninguna
  acción de "envío" real conectada, el campo y el chequeo existen desde
  ya para que la próxima que se agregue no pueda olvidarse de
  consultarlo).

## 9. Consentimiento, normalización y retención de consumidores

### Normalización antes de deduplicar

**Corregido en esta revisión**: la versión anterior deduplicaba
consumidores por `contacto_libre` **crudo** — dos formatos distintos del
mismo teléfono (`"3548 635151"` vs. `"+54 9 3548-635151"`) habrían
creado dos contactos distintos para la misma persona. Se corrige con una
función de normalización, y la deduplicación pasa a usar
`contacto_normalizado` (columna generada, §3):

```sql
create or replace function public.crm_normalizar_contacto(p_tipo text, p_contacto_libre text)
returns text
language sql
immutable
as $$
  select case
    when p_contacto_libre is null then null
    when p_contacto_libre like '%@%' then lower(trim(p_contacto_libre))
    else regexp_replace(p_contacto_libre, '[^0-9]', '', 'g')
  end;
$$;
```

Criterio simple y explícito: si el valor tiene un `@`, se trata como
email (normalizado a minúsculas, sin espacios). Si no, se trata como
teléfono (se conservan solo los dígitos — mismo criterio de "solo
dígitos" que ya usa el proyecto en otros lugares de limpieza de
teléfono). Es una normalización básica, no una validación de formato de
email ni un parser de números internacionales completo — suficiente
para el volumen y el caso de uso actual (consolidar reintentos del mismo
comprador), documentado como tal para no sobre-prometer.

**Riesgo de duplicación de lógica, reconocido explícitamente**: esta
misma normalización tiene que producir el mismo resultado tanto en SQL
(usada por el trigger de auto-vinculación, §9 más abajo) como en
cualquier lugar de la aplicación que necesite el mismo criterio (si lo
hubiera) — al ser una expresión de una sola línea (extraer dígitos, o
bajar a minúsculas un email), el riesgo de divergencia es bajo, pero el
plan debe incluir un test que compare explícitamente el comportamiento
esperado en ambos lados si llega a haber una implementación TypeScript
equivalente.

Índice único actualizado:

```sql
create unique index if not exists crm_contactos_consumidor_unico
  on public.crm_contactos (tipo, contacto_normalizado)
  where tipo = 'consumidor' and contacto_normalizado is not null;
```

### Reglas de consentimiento (cuatro, mantenidas de la versión anterior)

1. Interesados/cocinas se incorporan de forma automática e idempotente
   (§6) — sin restricción de consentimiento, no son datos de consumidor.
2. Los consumidores solo conservan una identidad de CRM duradera cuando
   dieron consentimiento de marketing — trigger `after insert on
   pedidos when (new.acepta_marketing)`, deduplicando por
   `contacto_normalizado` (actualizado respecto a la versión anterior,
   que deduplicaba por `contacto_libre` crudo):

```sql
create or replace function public.crm_vincular_pedido_consentido()
returns trigger language plpgsql as $$
declare
  v_contacto_id uuid;
  v_normalizado text;
begin
  if not new.acepta_marketing then
    return new;
  end if;

  v_normalizado := public.crm_normalizar_contacto('consumidor', new.telefono_comprador);

  insert into public.crm_contactos (tipo, nombre_libre, contacto_libre, fuente, estado)
  values ('consumidor', new.nombre_comprador, new.telefono_comprador, 'pedido', 'nuevo')
  on conflict (tipo, contacto_normalizado) where tipo = 'consumidor' and contacto_normalizado is not null
  do update set
    nombre_libre = excluded.nombre_libre,
    contacto_libre = excluded.contacto_libre
  returning id into v_contacto_id;

  insert into public.crm_contacto_pedidos (contacto_id, pedido_id)
  values (v_contacto_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;
```

3. Un pedido sin consentimiento sigue visible como operación, pero
   **nunca** puede convertirse manualmente en ficha comercial durable
   (§6, corregido explícitamente en esta revisión).
4. Consentimiento operativo y de marketing quedan completamente
   separados — el trigger lee solo `acepta_marketing`.

### Retiro de consentimiento (nueva sección de esta revisión)

Un consumidor puede pedir dejar de ser contactado. Dos acciones
administrativas nuevas, ambas en `app/admin/crm/actions.ts`:

- **`retirarConsentimiento(contactoId)`**: setea
  `consentimiento_retirado_en = now()`. Efecto inmediato: el contacto
  queda excluido de cualquier acción comercial — toda función que en el
  futuro dispare marketing (todavía no existe ninguna en esta entrega,
  pero el campo existe desde ya) debe filtrar explícitamente
  `where consentimiento_retirado_en is null`. El contacto **no se
  borra** — sigue existiendo como registro de que hubo una relación y de
  que se retiró el consentimiento (guardar esto es en sí mismo una buena
  práctica de cumplimiento, no un descuido de privacidad).
- **`anonimizarContacto(contactoId)`**: además de lo anterior, nullea
  `nombre_libre` y `contacto_libre` (con lo cual
  `contacto_normalizado`, columna generada, también pasa a `null`
  automáticamente) y marca `pii_eliminada = true`. **Se conservan**: la
  fila de `crm_contactos` en sí (con `tipo`, `fuente`, `estado`,
  `etiquetas` — nada de esto es PII) y todas sus filas de
  `crm_contacto_pedidos` (la relación operativa "este contacto anónimo
  hizo estos pedidos" puede seguir teniendo valor de negocio agregado —
  ej. contar cuántos pedidos totales generó el CRM — sin necesidad de
  saber quién era). Los pedidos mismos (`pedidos.nombre_comprador`, etc.)
  siguen su propio ciclo de purgado de 90 días definido en la spec de
  Carrito y pedidos, sin relación con esta acción.
- Un contacto con `pii_eliminada = true` no puede volver a recibir una
  copia durable automáticamente — si esa misma persona vuelve a comprar
  y da consentimiento de nuevo, el trigger de arriba, al deduplicar por
  `contacto_normalizado` (que ahora es `null` en el contacto anonimizado
  porque `contacto_libre` es `null`), **no encuentra conflicto** y crea
  un contacto nuevo — comportamiento correcto: la persona está
  ejerciendo un consentimiento nuevo, no "reactivando" el anterior.
