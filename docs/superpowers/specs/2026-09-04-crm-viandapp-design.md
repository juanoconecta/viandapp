# CRM general de ViandApp — Diseño

**Fecha:** 2026-09-04
**Estado:** Propuesto — pendiente de revisión de Codex
**Depende de:** nada técnicamente, pero se implementa último (ver plan) porque
se beneficia de que `pedidos` (Carrito y pedidos) y `puni_adhesiones`
(Envíos/Puni) ya existan para vincularse sin inventar de nuevo esos datos.

## 1. Objetivo

Darle al admin de ViandApp (hoy una sola persona, autenticada por
`ADMIN_EMAIL`) un lugar único para hacer seguimiento de: potenciales
cocinas, cocinas activas, consumidores que dejaron un contacto real,
aliados estratégicos (ej. Puni), y el historial de interacciones, notas y
tareas asociado a cada uno — sin duplicar los datos que ya viven en las
tablas especializadas (`vianderas`, `interesados_viandera`, `pedidos`).

Es una herramienta 100% interna. No hay superficie pública ni de
viandera/consumidor en esta entrega — ni falta: nada de lo pedido exige que
una viandera vea "su" fila de CRM.

## 2. Principio rector: vínculo, no copia

> "Las tablas especializadas existentes siguen siendo la fuente de verdad y
> el CRM se vincula con ellas sin duplicar información innecesariamente."

Cada `crm_contactos` referencia **como máximo una** tabla especializada vía
FK (`viandera_id`, `interesado_id` o `pedido_id`) o, si no hay ninguna
tabla especializada detrás (ej. un aliado estratégico, un consumidor que
llamó por teléfono sin dejar un pedido), guarda un `nombre_libre` propio.
Nunca ambas cosas a la vez, y nunca se copian `nombre`/`telefono`/etc. de
`vianderas` a una columna del CRM — se leen vía `join` en el momento de
mostrarlos.

Esto tiene una consecuencia deliberada: si `pedidos` purga los datos del
comprador después de su ventana de retención (ver spec de Carrito y
pedidos), el contacto de CRM vinculado a ese pedido **pierde
automáticamente** nombre y teléfono visibles — sin que el CRM necesite su
propia lógica de purgado. La política de privacidad de `pedidos` se hereda
gratis.

## 3. Modelo de datos

### `crm_contactos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `tipo` | `text` | `check in ('cocina_potencial','cocina_activa','consumidor','aliado_estrategico','otro')` |
| `viandera_id` | `uuid` | FK a `vianderas`, nullable |
| `interesado_id` | `uuid` | FK a `interesados_viandera`, nullable |
| `pedido_id` | `uuid` | FK a `pedidos`, nullable |
| `nombre_libre` | `text` | Solo para contactos sin tabla especializada detrás |
| `contacto_libre` | `text` | Teléfono/email libre, mismo caso que arriba |
| `fuente` | `text` | `check in ('landing_interes','explorador','pedido','referido','contacto_directo','otro')` |
| `estado` | `text` | `check in ('nuevo','en_conversacion','calificado','activo','inactivo','descartado')` |
| `etiquetas` | `text[]` | Libres, sin catálogo cerrado en esta entrega (ver §7) |
| `created_at` / `updated_at` | `timestamptz` | Trigger `viandapp_set_updated_at()` ya existente, reutilizado |

Constraints:

- `crm_contactos_un_solo_vinculo`: a lo sumo uno de `viandera_id` /
  `interesado_id` / `pedido_id` puede estar seteado.
- `crm_contactos_libre_o_vinculado`: si ninguno de los tres FKs está
  seteado, `nombre_libre` es obligatorio (nunca una fila totalmente vacía
  de identidad).

Un `viandera_id`/`interesado_id`/`pedido_id` dado puede tener **como
máximo un** `crm_contactos` — se refuerza con un índice único parcial por
columna (`unique (viandera_id) where viandera_id is not null`, etc.), para
que "vincular" sea idempotente: si el admin intenta crear un contacto para
una viandera que ya tiene uno, la operación falla explícitamente en vez de
crear un duplicado silencioso.

### `crm_notas`

Notas de texto libre, ordenadas cronológicamente, un contacto puede tener
muchas.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `contacto_id` | `uuid` | FK a `crm_contactos`, `on delete cascade` |
| `texto` | `text` | `check (char_length(texto) between 1 and 2000)` |
| `created_at` | `timestamptz` | |

Sin autor por ahora — hoy hay un solo admin (`ADMIN_EMAIL`), no una tabla
de roles. Si en el futuro hay más de un admin, agregar `creado_por text`
es un `alter table add column` aditivo, no una migración destructiva.

### `crm_tareas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `contacto_id` | `uuid` | FK a `crm_contactos`, `on delete cascade` |
| `titulo` | `text` | `check (char_length(titulo) between 1 and 200)` |
| `vence_en` | `date` | Nullable — no toda tarea tiene fecha límite |
| `completada` | `boolean` | `not null default false` |
| `completada_en` | `timestamptz` | Nullable, seteada cuando `completada` pasa a `true` |
| `created_at` | `timestamptz` | |

Mismo razonamiento que `crm_notas`: sin asignación a un usuario específico
en esta entrega (un solo admin).

### `crm_interacciones`

El mecanismo de **historial**: cada contacto tocado (llamada, WhatsApp,
email, reunión, o un cambio de estado) queda como una fila acá. No hay una
tabla de auditoría de estado separada — un cambio de `estado` en
`crm_contactos` se registra como una interacción con `tipo =
'cambio_estado'`, evitando duplicar el concepto de "historial" en dos
tablas distintas.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `contacto_id` | `uuid` | FK a `crm_contactos`, `on delete cascade` |
| `tipo` | `text` | `check in ('llamada','whatsapp','email','reunion','cambio_estado','otro')` |
| `resumen` | `text` | `check (char_length(resumen) between 1 and 1000)` |
| `metadata` | `jsonb` | `check (jsonb_typeof(metadata) = 'object')`, uso: para `cambio_estado` guarda `{"anterior": "...", "nuevo": "..."}` |
| `ocurrida_en` | `timestamptz` | `not null default now()` — puede cargarse retroactivamente (ej. "llamé ayer") |
| `created_at` | `timestamptz` | Cuándo se registró la fila (vs. `ocurrida_en`, cuándo pasó de verdad) |

## 4. Acceso y RLS

100% admin-only. Ninguna de las cuatro tablas (`crm_contactos`,
`crm_notas`, `crm_tareas`, `crm_interacciones`) tiene una policy de RLS
para `anon` ni `authenticated` — RLS habilitado, cero policies, igual que
`eventos_analitica`. Todo el acceso (lectura y escritura) pasa por Server
Actions que:

1. Llaman `createClient()` (respeta RLS) para leer
   `supabase.auth.getUser()`.
2. Verifican `esAdmin(user?.email)` — si no, devuelven un error sin tocar
   la base.
3. Recién ahí usan `createAdminClient()` (service role, bypasea RLS) para
   la operación real.

Exactamente el patrón ya usado en `app/admin/actions.ts` (`invitarViandera`)
— no se introduce ningún mecanismo de autorización nuevo.

No hay UI pública ni de viandera que lea estas tablas. Si en el futuro una
viandera necesita ver "sus" notas o tareas, es una decisión de producto
nueva con su propio spec — no se prediseña acá (YAGNI).

## 5. Vistas de lectura para la UI del panel

Para que el panel no arme cuatro consultas separadas por cada contacto
listado, dos vistas (`security_invoker = true`, solo para uso desde el
admin client — no cambia el modelo de RLS, son azúcar de lectura):

```sql
create view public.crm_contactos_resumen
with (security_invoker = true) as
select
  c.id,
  c.tipo,
  c.fuente,
  c.estado,
  c.etiquetas,
  c.created_at,
  c.updated_at,
  coalesce(v.nombre, i.nombre, p.nombre_comprador, c.nombre_libre) as nombre,
  coalesce(v.telefono, i.contacto, p.telefono_comprador, c.contacto_libre) as contacto,
  c.viandera_id,
  c.interesado_id,
  c.pedido_id
from public.crm_contactos c
left join public.vianderas v on v.id = c.viandera_id
left join public.interesados_viandera i on i.id = c.interesado_id
left join public.pedidos p on p.id = c.pedido_id;
```

`crm_contactos_resumen.contacto` para un `pedido_id` cuyo `pedidos.datos_purgados
= true` devuelve `null` naturalmente (los campos de `pedidos` ya están
nulleados por el job de purgado) — es la propagación automática de la
política de retención mencionada en §2, no requiere lógica extra acá.

## 6. Alta automática vs. manual

En esta entrega, **ningún trigger crea filas de `crm_contactos`
automáticamente**. Cuando llega un `interesados_viandera` nuevo o un
`pedidos` nuevo, el admin decide manualmente si vale la pena convertirlo en
un contacto de CRM (un botón "Agregar a CRM" en el panel, que hace el
insert con el vínculo correspondiente). Justificación: automatizarlo
significaría que CADA lead de la landing y CADA pedido generan una fila —
en el volumen actual (fase de validación de mercado) eso es ruido, no
señal. Si el volumen crece y esto se vuelve tedioso, automatizarlo es un
cambio aditivo posterior (un trigger o un cron), no una migración
destructiva.

## 7. Fuera de alcance de esta entrega

- Catálogo cerrado de etiquetas (hoy `text[]` libre — igual que
  `viandas.etiquetas`, que tampoco tiene catálogo en DB, solo una lista
  fija en `lib/viandera/etiquetas.ts` usada por la UI). Si hace falta
  restringir etiquetas de CRM a una lista fija, es una mejora posterior
  sin cambio de schema (solo UI + validación en el Server Action).
- Asignación de tareas/notas a un usuario específico (un solo admin hoy).
- Automatización de pipeline (mover un contacto de estado automáticamente
  por reglas).
- Reportes/dashboards agregados — el panel muestra listas y detalle de
  contacto, no métricas.
- Integración con `eventos_analitica` (que hoy ni siquiera está conectada
  a la interfaz, según `CLAUDE.md`) — cuando se conecte, vincular eventos
  a `crm_contactos` es una mejora aditiva futura, no parte de esta
  entrega.
- Cualquier vínculo automático con Puni (`puni_adhesiones`) — el aliado
  "Puni Rafaela" se carga como un `crm_contactos` de tipo
  `aliado_estrategico` manualmente, sin FK a `puni_adhesiones` (esa tabla
  es sobre configuración de envíos, no sobre la relación comercial con
  Puni como aliado).

## 8. Checklist de seguridad y privacidad

- RLS habilitado en las 4 tablas nuevas, cero policies para `anon`/
  `authenticated`.
- Ninguna Server Action de CRM ejecuta sin pasar primero por `esAdmin()`.
- `crm_contactos_resumen` no expone más de lo que ya era visible por otra
  vía (nombre/contacto de las tablas especializadas ya son legibles por el
  admin hoy vía `/admin` o Supabase Dashboard).
- Ningún dato nuevo de PII se introduce — el CRM solo referencia PII que
  ya existía en `vianderas`/`interesados_viandera`/`pedidos`.
- `crm_notas.texto` y `crm_interacciones.resumen` son texto libre escrito
  por el admin — advertencia en la UI para no pegar ahí datos sensibles
  del comprador que no hagan falta (ej. no transcribir un número de
  tarjeta que nunca debería haber existido, dado que no hay pagos
  online).
