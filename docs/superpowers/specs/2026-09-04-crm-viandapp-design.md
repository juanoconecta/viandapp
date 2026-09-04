# CRM general de ViandApp — Diseño

**Fecha:** 2026-09-04 (revisión correctiva 2026-09-04)
**Estado:** Corregido tras revisión de Codex sobre el commit `4196de3` —
pendiente de una segunda revisión antes de implementar. Cambios de esta
revisión: `crm_contactos.pedido_id` eliminado (un consumidor puede tener
muchos pedidos) reemplazado por `crm_contacto_pedidos` (§3), altas
idempotentes explícitas para interesados/cocinas (§6), un consumidor solo
obtiene una ficha de CRM duradera cuando dio consentimiento de marketing
— un pedido sin ese consentimiento no crea ficha comercial permanente
(§6, §9 nueva).
**Depende de:** nada técnicamente, pero se implementa último (ver plan)
porque se beneficia de que `pedidos` (Carrito y pedidos) y
`puni_adhesiones` (Envíos/Puni) ya existan para vincularse sin inventar de
nuevo esos datos. El trigger de §6 que auto-vincula un pedido
consentido **se agrega sobre la tabla `pedidos` ya existente** desde la
migración de CRM — el plan de Carrito y pedidos no necesita saber que el
CRM existe ni referenciarlo, preservando la independencia de ambos
planes.

## 1. Objetivo

Darle al admin de ViandApp (hoy una sola persona, autenticada por
`ADMIN_EMAIL`) un lugar único para hacer seguimiento de: potenciales
cocinas, cocinas activas, consumidores que dieron consentimiento de
marketing, aliados estratégicos (ej. Puni), y el historial de
interacciones, notas y tareas asociado a cada uno — sin duplicar los
datos que ya viven en las tablas especializadas (`vianderas`,
`interesados_viandera`, `pedidos`).

Es una herramienta 100% interna. No hay superficie pública ni de
viandera/consumidor en esta entrega.

## 2. Principio rector: vínculo, no copia — con una excepción explícita

> "Las tablas especializadas existentes siguen siendo la fuente de verdad y
> el CRM se vincula con ellas sin duplicar información innecesariamente."

Cada `crm_contactos` referencia **como máximo una** tabla especializada vía
FK (`viandera_id` o `interesado_id`) o, si no hay ninguna tabla
especializada detrás (aliado estratégico, consumidor), guarda un
`nombre_libre` propio. Para cocinas (potenciales y activas), nunca se
copian `nombre`/`telefono`/etc. — se leen vía `join` en el momento de
mostrarlos, así que la política de retención/edición de `vianderas`/
`interesados_viandera` se hereda automáticamente.

**Excepción deliberada para consumidores** (nueva en esta revisión, ver
§9): un consumidor que dio **consentimiento de marketing** en un pedido sí
obtiene una copia durable de su nombre y contacto en `nombre_libre`/
`contacto_libre`, tomada en el momento del consentimiento. Esto no es
"duplicación innecesaria" — es la consecuencia necesaria de separar dos
retenciones con propósitos distintos: `pedidos` purga PII operativa a los
90 días **sin importar el consentimiento de marketing** (spec de Carrito
y pedidos §9), pero un consentimiento de marketing es, por definición, una
autorización a ser recordado más allá de esa ventana — si el CRM solo
leyera en vivo desde `pedidos`, el consentimiento de marketing sería
inútil en la práctica (el dato desaparecería a los 90 días de todas
formas). Un consumidor **sin** ese consentimiento nunca obtiene esta
copia — su pedido sigue siendo visible como operación (en `pedidos`
mismo, o vía un vínculo manual de solo lectura mientras la fila viva), 
pero no genera una ficha comercial permanente.

## 3. Modelo de datos

### `crm_contactos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `tipo` | `text` | `check in ('cocina_potencial','cocina_activa','consumidor','aliado_estrategico','otro')` |
| `viandera_id` | `uuid` | FK a `vianderas`, nullable |
| `interesado_id` | `uuid` | FK a `interesados_viandera`, nullable |
| `nombre_libre` | `text` | Obligatorio si no hay `viandera_id`/`interesado_id` — ver §2 |
| `contacto_libre` | `text` | Teléfono/email libre, mismo caso que arriba |
| `fuente` | `text` | `check in ('landing_interes','explorador','pedido','referido','contacto_directo','otro')` |
| `estado` | `text` | `check in ('nuevo','en_conversacion','calificado','activo','inactivo','descartado')` |
| `etiquetas` | `text[]` | Libres, sin catálogo cerrado en esta entrega |
| `created_at` / `updated_at` | `timestamptz` | |

Constraints:

- `crm_contactos_un_solo_vinculo`: a lo sumo uno de `viandera_id` /
  `interesado_id` puede estar seteado (`pedido_id` ya no existe acá — ver
  `crm_contacto_pedidos` abajo).
- `crm_contactos_libre_o_vinculado`: si ninguno de los dos FKs está
  seteado, `nombre_libre` es obligatorio.

`viandera_id`/`interesado_id` tienen índice único parcial (`unique
(viandera_id) where viandera_id is not null`, etc.) — vincular la misma
cocina dos veces falla explícitamente.

### `crm_contacto_pedidos` (nueva en esta revisión)

Un consumidor puede tener muchos pedidos — la relación es de muchos a
muchos en potencia (aunque en la práctica cada pedido tiene un solo
contacto). Reemplaza el `pedido_id` directo que tenía `crm_contactos` en
la versión anterior de esta spec.

```sql
create table public.crm_contacto_pedidos (
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contacto_id, pedido_id)
);
```

La clave primaria compuesta **es** la garantía de idempotencia: vincular
el mismo pedido al mismo contacto dos veces no crea una segunda fila, un
`insert ... on conflict do nothing` es siempre seguro.

### `crm_notas`, `crm_tareas`, `crm_interacciones`

Sin cambios respecto a la versión anterior de esta spec — notas de texto
libre, tareas sin asignación (un solo admin hoy), e interacciones como
mecanismo de historial (incluyendo `cambio_estado` para no duplicar el
concepto de auditoría en una tabla aparte). Ver la migración del plan
para el detalle completo de columnas.

## 4. Acceso y RLS

100% admin-only. Ninguna de las cinco tablas (`crm_contactos`,
`crm_contacto_pedidos`, `crm_notas`, `crm_tareas`, `crm_interacciones`)
tiene una policy de RLS para `anon` ni `authenticated` — RLS habilitado,
cero policies, igual que `eventos_analitica`. Todo el acceso pasa por
Server Actions que verifican `esAdmin()` antes de usar
`createAdminClient()` — mismo patrón que `invitarViandera`.

## 5. Vistas de lectura para la UI del panel

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
  coalesce(v.nombre, i.nombre, c.nombre_libre, ultimo_pedido.nombre_comprador) as nombre,
  coalesce(v.telefono, i.contacto, c.contacto_libre, ultimo_pedido.telefono_comprador) as contacto,
  c.viandera_id,
  c.interesado_id
from public.crm_contactos c
left join public.vianderas v on v.id = c.viandera_id
left join public.interesados_viandera i on i.id = c.interesado_id
left join lateral (
  select p.nombre_comprador, p.telefono_comprador
  from public.crm_contacto_pedidos cp
  join public.pedidos p on p.id = cp.pedido_id
  where cp.contacto_id = c.id
  order by p.created_at desc
  limit 1
) ultimo_pedido on c.nombre_libre is null and c.viandera_id is null and c.interesado_id is null;
```

Dos casos de "nombre/contacto" para un `consumidor`: si dio
consentimiento de marketing, `nombre_libre`/`contacto_libre` ya están
poblados (durables, sobreviven al purgado de `pedidos` — ver §9) y se
usan directo. Si no, se cae al `left join lateral` sobre su pedido más
reciente vinculado manualmente — que si ya fue purgado por la ventana de
90 días, devuelve `null` naturalmente (misma propagación automática de
retención que en la versión anterior de esta spec, ahora a través de la
tabla intermedia en vez de una FK directa).

## 6. Altas al CRM

### Interesados de la landing y cocinas activas: manuales, idempotentes

Sin cambios de fondo respecto a la versión anterior: **ningún trigger
crea filas de `crm_contactos` automáticamente** para `vianderas` o
`interesados_viandera` — el admin decide manualmente vía un botón
"Agregar a CRM". **Corrección de esta revisión**: la operación de alta es
explícitamente idempotente — un segundo click sobre un contacto que ya
existe (mismo `viandera_id`/`interesado_id`) no falla con un error crudo
de constraint, la Server Action hace `insert ... on conflict (viandera_id)
where viandera_id is not null do nothing returning *` y, si no insertó
nada, hace `select` del contacto existente y lo devuelve igual —
idempotente de verdad, no solo "falla de forma prolija".

### Consumidores: automático, condicionado a consentimiento de marketing

Ver §9. Un pedido con `acepta_marketing = true` dispara automáticamente
(vía trigger sobre `pedidos`, agregado por la migración de CRM) la
creación o actualización de un `crm_contactos` de tipo `consumidor` con
copia durable de nombre/contacto, más el vínculo en
`crm_contacto_pedidos`. Un pedido sin ese consentimiento **no** dispara
nada automático — el admin puede, si quiere, vincularlo manualmente
desde el panel (mismo botón "Agregar a CRM", ahora aplicado a un pedido)
mientras la fila de `pedidos` todavía tenga los datos del comprador, pero
esa acción es manual, explícita, y no copia `nombre_libre` a menos que el
admin lo indique al hacerlo — si no, el contacto queda con nombre/
contacto derivados en vivo del pedido (§5), sujetos al mismo purgado a
los 90 días.

## 7. Fuera de alcance de esta entrega

- Catálogo cerrado de etiquetas.
- Asignación de tareas/notas a un usuario específico (un solo admin hoy).
- Automatización de pipeline más allá del alta condicionada a
  consentimiento descrita en §6/§9.
- Reportes/dashboards agregados.
- Integración con `eventos_analitica` (todavía no conectada a la
  interfaz).
- Cualquier vínculo automático con Puni (`puni_adhesiones`) — el aliado
  "Puni Rafaela" se carga como un `crm_contactos` de tipo
  `aliado_estrategico` manualmente.

## 8. Checklist de seguridad y privacidad

- RLS habilitado en las 5 tablas nuevas, cero policies para `anon`/
  `authenticated`.
- Ninguna Server Action de CRM ejecuta sin pasar primero por `esAdmin()`.
- `crm_contactos_resumen` no expone más de lo que ya era visible por otra
  vía.
- Ningún dato nuevo de PII se introduce salvo la copia durable descrita
  en §9, que existe únicamente porque hay una base legal explícita
  (consentimiento de marketing) para retenerla más allá de la ventana
  operativa de 90 días.
- `crm_notas.texto` y `crm_interacciones.resumen` son texto libre escrito
  por el admin — advertencia en la UI para no pegar ahí datos que no
  hagan falta guardar.

## 9. Consentimiento y retención de consumidores (nueva en esta revisión)

Cuatro reglas, todas verificables por separado:

1. **Los interesados de la landing y las cocinas activas se incorporan de
   forma idempotente** — ver §6. No son datos de consumidor, no tienen
   esta restricción de consentimiento (una vianders o un interesado ya
   dieron sus datos directamente para ese propósito, no hay una
   distinción operativa/marketing que hacer ahí).
2. **Los consumidores solo conservan una identidad de CRM duradera cuando
   dieron consentimiento de marketing.** Implementado como un trigger
   `after insert on public.pedidos when (new.acepta_marketing)`:

```sql
-- Se agrega en la migración de CRM, sobre la tabla pedidos ya existente
-- (creada por el plan de Carrito y pedidos). No requiere que ese plan
-- sepa nada de CRM.
create or replace function public.crm_vincular_pedido_consentido()
returns trigger language plpgsql as $$
declare
  v_contacto_id uuid;
begin
  if not new.acepta_marketing then
    return new;
  end if;

  insert into public.crm_contactos (tipo, nombre_libre, contacto_libre, fuente, estado)
  values ('consumidor', new.nombre_comprador, new.telefono_comprador, 'pedido', 'nuevo')
  on conflict (tipo, contacto_libre) where tipo = 'consumidor' and contacto_libre is not null
  do update set nombre_libre = excluded.nombre_libre
  returning id into v_contacto_id;

  insert into public.crm_contacto_pedidos (contacto_id, pedido_id)
  values (v_contacto_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists crm_vincular_pedido_consentido_trigger on public.pedidos;
create trigger crm_vincular_pedido_consentido_trigger
after insert on public.pedidos
for each row execute function public.crm_vincular_pedido_consentido();
```

   Requiere un índice único parcial nuevo en `crm_contactos`:
   `unique (tipo, contacto_libre) where tipo = 'consumidor' and
   contacto_libre is not null` — así un comprador que vuelve a pedir con
   el mismo teléfono consolida en el mismo contacto (actualiza
   `nombre_libre` por si cambió, y agrega el nuevo pedido a
   `crm_contacto_pedidos`) en vez de crear una ficha nueva por cada
   compra.
3. **Un pedido sin consentimiento sigue visible como operación, pero no
   crea una ficha comercial permanente.** El trigger de arriba
   simplemente no se dispara — el pedido sigue existiendo íntegro en
   `pedidos` (y visible en el panel de la vendedora), pero no aparece en
   el CRM salvo que el admin lo vincule manualmente (§6), y en ese caso
   sin la copia durable.
4. **Consentimiento operativo y de marketing quedan completamente
   separados** — el trigger de arriba lee exclusivamente
   `acepta_marketing`, nunca infiere nada de que el pedido se haya creado
   o confirmado. Un pedido `confirmado`/`rechazado` sin `acepta_marketing
   = true` nunca genera una ficha de CRM por ese solo hecho.
