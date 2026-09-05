# CRM general de ViandApp — Diseño

**Fecha:** 2026-09-04 (tercera revisión correctiva y aprobación 2026-09-04)
**Estado:** Diseño aprobado por el usuario; listo para actualizar el plan
de implementación. Esta tercera revisión cierra la arquitectura del panel
administrativo, el entorno de staging y la normalización telefónica que la
revisión anterior describía de forma contradictoria.

**Decisiones cerradas:** CRM integrado en la misma aplicación Next.js y
el mismo modelo Supabase de ViandApp; un único administrador configurado
por `ADMIN_EMAIL`; `/admin` pasa a ser el tablero general; CRM, pedidos y
Puni viven como módulos separados dentro del administrador; las pruebas de
integración se ejecutan en un proyecto Supabase separado llamado
`viandapp-staging`, sin copiar datos personales de producción.

**Depende de:** el plan de Carrito y pedidos implementado y migrado primero,
porque `crm_contacto_pedidos` y el trigger de consumidores referencian las
tablas `pedidos`/`pedido_items`. Los triggers sobre
`interesados_viandera` y `vianderas` sí se apoyan en tablas ya existentes.

## 1. Objetivo

Convertir el actual `/admin` puntual en el administrador general de
ViandApp. El sistema reúne contactos comerciales, cocinas potenciales y
activas, consumidores que dieron consentimiento, aliados, notas, tareas,
interacciones y pedidos vinculados. La administración de adhesiones a Puni
se conserva como un módulo del mismo panel, no como la totalidad del panel.

El CRM se construye dentro de ViandApp: no se crea una segunda aplicación
ni se sincroniza con un proveedor de CRM externo. El objetivo inicial es
una operación personal, segura y trazable para un único administrador.

## 2. Principio rector: vínculo, no copia — con una excepción explícita y ahora revocable

Cada `crm_contactos` referencia como máximo una tabla especializada, o
guarda `nombre_libre` si no hay ninguna. Los datos de una cocina o un
interesado se consultan desde su registro fuente y no se duplican. La única
excepción es el consumidor que dio consentimiento de marketing: su copia
durable es explícita y revocable — ver §9.

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
| `contacto_normalizado` | `text` | `generated always as (public.crm_normalizar_contacto(contacto_libre)) stored`. Es la columna que se usa para deduplicar (§9), nunca `contacto_libre` crudo. |
| `fuente` | `text` | `check in ('landing_interes','explorador','pedido','referido','contacto_directo','otro')` |
| `estado` | `text` | `check in ('nuevo','en_conversacion','calificado','activo','inactivo','descartado')` |
| `etiquetas` | `text[]` | Libres |
| `consentimiento_retirado_en` | `timestamptz` | Nullable; no-nulo excluye inmediatamente al contacto de cualquier acción comercial (§9) |
| `pii_eliminada` | `boolean` | `not null default false`; `true` cuando el admin anonimizó `nombre_libre`/`contacto_libre` (§9) |
| `created_at` / `updated_at` | `timestamptz` | |

Constraints:

- `crm_contactos_un_solo_vinculo`: como máximo uno entre `viandera_id`
  e `interesado_id`.
- `crm_contactos_libre_o_vinculado`: exige una fuente vinculada,
  `nombre_libre` o `pii_eliminada = true`. La última alternativa permite
  conservar una fila anónima sin violar la constraint.
- `crm_contactos_anonimizacion_consistente`: si `pii_eliminada = true`,
  el tipo es `consumidor`, ambos vínculos y los campos `nombre_libre`/
  `contacto_libre` son `null`, y `consentimiento_retirado_en` no es
  `null`. Una cocina o interesado no puede marcarse como anonimizado
  mientras su PII siga viva en la tabla fuente.

### `crm_contacto_pedidos`

Tabla puente entre contactos y pedidos. Contiene `contacto_id`,
`pedido_id` y `created_at`; su PK compuesta (`contacto_id`, `pedido_id`)
impide registrar dos veces el mismo vínculo.

### `crm_notas`, `crm_tareas`, `crm_interacciones`

- `crm_notas`: texto administrativo de 1 a 2000 caracteres asociado a un
  contacto.
- `crm_tareas`: título, vencimiento opcional y estado de finalización con
  timestamp consistente.
- `crm_interacciones`: llamada, WhatsApp, email, reunión, cambio de estado
  u otro evento, con resumen y metadata JSON acotada a un objeto.

## 4. Acceso y RLS

El CRM es 100% admin-only. Las cinco tablas tienen RLS habilitado y cero
policies. Cada Server Action autentica al usuario y verifica `esAdmin()`
antes de crear el cliente con `service_role`.

En esta etapa hay un único administrador, identificado por comparación
case-insensitive contra `ADMIN_EMAIL`. No se agregan roles, invitaciones ni
una tabla de miembros. Si el producto incorpora equipo en el futuro, eso
requerirá un diseño de autorización independiente.

## 5. Vistas de lectura para la UI del panel

`crm_contactos_resumen` resuelve nombre y contacto desde la fuente
vinculada (`vianderas` o `interesados_viandera`) y usa los campos libres
solo para contactos sin fuente especializada. Nunca usa el último pedido
como fallback: hacerlo expondría nuevamente la PII de un consumidor
anonimizado o de un pedido sin consentimiento. Cuando
`pii_eliminada = true`, la vista devuelve `null` explícitamente para
nombre y contacto. También expone `consentimiento_retirado_en` y
`pii_eliminada`, para que la UI muestre ese estado sin otra consulta.

## 6. Altas al CRM

### Interesados de la landing y cocinas activas: automáticas e idempotentes

Ambas fuentes se sincronizan solas, vía trigger, en el momento en que la
fila especializada se crea:

```sql
create or replace function public.crm_sincronizar_interesado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.crm_contactos (tipo, interesado_id, fuente, estado)
  values ('cocina_potencial', new.id, 'landing_interes', 'nuevo')
  on conflict (interesado_id) where interesado_id is not null do nothing;
  return new;
end;
$$;

revoke all on function public.crm_sincronizar_interesado()
from public, anon, authenticated;

drop trigger if exists crm_sincronizar_interesado_trigger on public.interesados_viandera;
create trigger crm_sincronizar_interesado_trigger
after insert on public.interesados_viandera
for each row execute function public.crm_sincronizar_interesado();

create or replace function public.crm_sincronizar_viandera()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.crm_contactos (tipo, viandera_id, fuente, estado)
  values ('cocina_activa', new.id, 'contacto_directo', 'nuevo')
  on conflict (viandera_id) where viandera_id is not null do nothing;
  return new;
end;
$$;

revoke all on function public.crm_sincronizar_viandera()
from public, anon, authenticated;

drop trigger if exists crm_sincronizar_viandera_trigger on public.vianderas;
create trigger crm_sincronizar_viandera_trigger
after insert on public.vianderas
for each row execute function public.crm_sincronizar_viandera();

-- Backfill idempotente: los triggers solo cubren filas nuevas.
insert into public.crm_contactos (tipo, interesado_id, fuente, estado)
select 'cocina_potencial', i.id, 'landing_interes', 'nuevo'
from public.interesados_viandera i
on conflict (interesado_id) where interesado_id is not null do nothing;

insert into public.crm_contactos (tipo, viandera_id, fuente, estado)
select 'cocina_activa', v.id, 'contacto_directo', 'nuevo'
from public.vianderas v
on conflict (viandera_id) where viandera_id is not null do nothing;
```

`on conflict ... do nothing` sobre el índice único parcial ya existente
es la idempotencia: una fila que ya tiene su contacto vinculado (por
ejemplo, si se re-ejecuta el trigger en un escenario de prueba, o si el
admin la había vinculado manualmente antes de que este trigger
existiera) no genera una segunda.

La sincronización automática prioriza que el CRM sea una fuente de verdad
**completa**. El posible ruido se maneja filtrando por `estado` en el panel
(los nuevos entran en `'nuevo'` y no exigen atención inmediata), no
dependiendo de que el administrador recuerde un botón para cada lead.

Los triggers son `SECURITY DEFINER` porque el alta pública de
`interesados_viandera` corre como `anon`, que no tiene acceso a las tablas
CRM. El cuerpo usa nombres calificados, `search_path` vacío y valores fijos;
además se revoca su ejecución directa. Así el formulario público puede
crear el contacto derivado sin abrir una policy sobre el CRM. El backfill
de la misma migración incorpora filas preexistentes de forma idempotente.

### Consumidores: automático, condicionado a consentimiento de marketing — nunca manual sin consentimiento

Un trigger sobre `pedidos`, disparado solo por
`acepta_marketing = true`, crea o vincula al consumidor — ver §9. No
existe una vía manual para copiar de forma durable el nombre o teléfono
de un pedido sin consentimiento. Un pedido sin `acepta_marketing = true`:

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

- Equipos, roles o más de un administrador.
- Envíos masivos de marketing o automatizaciones de contacto.
- Integración o sincronización con un CRM externo.
- Pagos online o facturación.
- Importar PII o una copia de la base de producción al staging.
- Analítica avanzada de embudos; el tablero inicial usa conteos y estados
  operativos.

## 8. Checklist de seguridad y privacidad

- RLS habilitado en las 5 tablas, cero policies.
- Ninguna Server Action de CRM ejecuta sin `esAdmin()`.
- Copia durable de PII solo con base legal explícita (consentimiento de
  marketing), y ahora **revocable** (§9).
- `crm_notas.texto`/`crm_interacciones.resumen`: advertencia en la UI.
- Un contacto con `consentimiento_retirado_en`
  no-nulo queda excluido de inmediato de cualquier acción comercial —
  verificado explícitamente en cada Server Action que envíe o programe
  algo hacia un contacto (aunque esta entrega no tiene todavía ninguna
  acción de "envío" real conectada, el campo y el chequeo existen desde
  ya para que la próxima que se agregue no pueda olvidarse de
  consultarlo).

## 9. Consentimiento, normalización y retención de consumidores

### Normalización antes de deduplicar

La deduplicación nunca usa `contacto_libre` crudo. La segunda revisión
proponía conservar todos los dígitos, pero a la vez afirmaba que
`"3548 635151"` y `"+54 9 3548-635151"` producirían el mismo valor. Eso
era falso: el prefijo `549` sobrevivía. Esta tercera revisión define una
forma canónica comprobable: email en minúsculas y sin espacios externos;
teléfono solo con dígitos y, cuando el resto tiene exactamente diez
dígitos nacionales, sin los prefijos argentinos `549` o `54`.

```sql
create or replace function public.crm_normalizar_contacto(p_contacto_libre text)
returns text
language sql
immutable
as $$
  select case
    when p_contacto_libre is null then null
    when p_contacto_libre like '%@%'
      then nullif(lower(trim(p_contacto_libre)), '')
    when digitos ~ '^549[0-9]{10}$' then substring(digitos from 4)
    when digitos ~ '^54[0-9]{10}$' then substring(digitos from 3)
    else nullif(digitos, '')
  end
  from (
    select regexp_replace(p_contacto_libre, '[^0-9]', '', 'g') as digitos
  ) limpio;
$$;
```

Criterio deliberadamente acotado: se resuelven los formatos usados por el
producto (`3548635151`, `+54 3548635151` y `+54 9 3548635151`). No se
intenta inferir códigos de área ni transformar el prefijo histórico `15`;
eso requeriría un parser telefónico argentino más amplio. Una cadena vacía
o sin dígitos normaliza a `null` y no participa del índice único.

La implementación TypeScript y la función SQL deben compartir los mismos
casos tabulares: email, número nacional, `+54`, `+54 9`, vacío y entradas
que no se intentan interpretar. Los tests de integración comparan ambas
salidas para evitar que la lógica diverja.

Índice único actualizado:

```sql
create unique index if not exists crm_contactos_consumidor_unico
  on public.crm_contactos (tipo, contacto_normalizado)
  where tipo = 'consumidor' and contacto_normalizado is not null;
```

### Reglas de consentimiento

1. Interesados/cocinas se incorporan de forma automática e idempotente
   (§6) — sin restricción de consentimiento, no son datos de consumidor.
2. Los consumidores solo conservan una identidad de CRM duradera cuando
   dieron consentimiento de marketing — trigger `after insert on
   pedidos when (new.acepta_marketing)`, deduplicando por
   `contacto_normalizado`:

```sql
create or replace function public.crm_vincular_pedido_consentido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contacto_id uuid;
begin
  if not new.acepta_marketing then
    return new;
  end if;

  insert into public.crm_contactos (tipo, nombre_libre, contacto_libre, fuente, estado)
  values ('consumidor', new.nombre_comprador, new.telefono_comprador, 'pedido', 'nuevo')
  on conflict (tipo, contacto_normalizado) where tipo = 'consumidor' and contacto_normalizado is not null
  do update set
    nombre_libre = excluded.nombre_libre,
    contacto_libre = excluded.contacto_libre,
    consentimiento_retirado_en = null,
    pii_eliminada = false
  returning id into v_contacto_id;

  insert into public.crm_contacto_pedidos (contacto_id, pedido_id)
  values (v_contacto_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.crm_vincular_pedido_consentido()
from public, anon, authenticated;
```

3. Un pedido sin consentimiento sigue visible como operación, pero
   **nunca** puede convertirse manualmente en ficha comercial durable
   (§6).
4. Consentimiento operativo y de marketing quedan completamente
   separados — el trigger lee solo `acepta_marketing`.
5. Si un consumidor retiró consentimiento pero luego lo otorga de nuevo
   explícitamente en otro pedido, el conflicto por contacto normalizado
   reutiliza la ficha no anonimizada y limpia
   `consentimiento_retirado_en`. Si la ficha anterior fue anonimizada, su
   contacto normalizado es `null` y se crea una ficha nueva.

### Retiro de consentimiento

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
- Ambas acciones verifican que `tipo = 'consumidor'`; si el ID pertenece a
  una cocina, interesado, aliado u otro contacto, no modifican ninguna
  fila y devuelven un error de dominio. La privacidad de esas fuentes se
  gestiona en su tabla especializada, no simulando anonimización en el CRM.
- Un contacto con `pii_eliminada = true` no puede volver a recibir una
  copia durable automáticamente — si esa misma persona vuelve a comprar
  y da consentimiento de nuevo, el trigger de arriba, al deduplicar por
  `contacto_normalizado` (que ahora es `null` en el contacto anonimizado
  porque `contacto_libre` es `null`), **no encuentra conflicto** y crea
  un contacto nuevo — comportamiento correcto: la persona está
  ejerciendo un consentimiento nuevo, no "reactivando" el anterior.

## 10. Arquitectura del administrador integrado

`/admin` deja de ser una pantalla dedicada a Puni y se convierte en un
tablero con navegación estable y resúmenes accionables:

- `/admin`: inicio con conteos de contactos nuevos, tareas vencidas,
  pedidos recientes y solicitudes Puni pendientes.
- `/admin/crm`: listado filtrable de contactos.
- `/admin/crm/[id]`: detalle, notas, tareas, interacciones, pedidos y
  consentimiento.
- `/admin/pedidos`: operación y cambio de estado de pedidos.
- `/admin/puni`: solicitudes y resoluciones de adhesión que hoy viven en
  `/admin`.

Todos los módulos comparten el mismo layout, autenticación y navegación.
Mover Puni a `/admin/puni` no cambia su modelo de permisos ni permite que
el administrador cargue el costo de envío: ese dato sigue perteneciendo a
la cocina aprobada.

## 11. Entorno de staging y promoción

Las migraciones de Carrito/Pedidos y CRM se aplican primero a
`viandapp-staging`, un proyecto Supabase independiente. El staging usa
usuarios y datos sintéticos; nunca recibe un volcado de PII de producción.
Que el proyecto gratuito se pause por inactividad solo interrumpe pruebas:
no afecta `viandapp.ar` ni la base productiva y se lo reactiva antes de una
sesión de integración.

Una migración avanza a producción únicamente cuando:

1. pasaron unitarios e integración contra staging;
2. se verificaron RLS, privilegios y atomicidad;
3. existe un backup/preflight de producción;
4. el usuario autorizó explícitamente aplicar esa migración.

La publicación web tiene un gate separado: se muestra una vista previa y
se solicita autorización antes de hacer `git push` a `main`.
