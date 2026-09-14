-- Pedidos por WhatsApp: captura atómica, idempotencia y contador privado.
-- Escrita y revisada estáticamente; NO aplicada ni validada en Postgres.
-- Repetible sobre su propio esquema; no reconcilia objetos incompatibles.
begin;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  request_hash text not null,
  vianderas_id uuid not null references public.vianderas(id) on delete restrict,
  modalidad text not null check (modalidad in ('retiro', 'envio_propio', 'envio_puni')),
  costo_envio_capturado numeric not null default 0
    check (costo_envio_capturado >= 0 and costo_envio_capturado::text not in ('NaN', 'Infinity', '-Infinity')),
  total numeric not null
    check (total >= 0 and total::text not in ('NaN', 'Infinity', '-Infinity')),
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
  precio_capturado numeric not null
    check (precio_capturado >= 0 and precio_capturado::text not in ('NaN', 'Infinity', '-Infinity')),
  cantidad integer not null check (cantidad between 1 and 50),
  subtotal numeric generated always as (precio_capturado * cantidad) stored
);

create index if not exists pedidos_vianderas_id_idx on public.pedidos (vianderas_id);
create index if not exists pedido_items_pedido_id_idx on public.pedido_items (pedido_id);

alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;

create or replace function public.pedidos_validar_transicion()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- El servicio puede purgar PII y realizar operaciones administrativas.
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  -- Protege también consentimiento, retención, PK y fechas de creación.
  if (to_jsonb(new) - 'estado' - 'updated_at')
     is distinct from (to_jsonb(old) - 'estado' - 'updated_at') then
    raise exception 'solo se puede modificar el estado del pedido';
  end if;

  if not (
    (old.estado = 'generado' and new.estado in ('confirmado', 'rechazado'))
    or old.estado = new.estado
  ) then
    raise exception 'transicion de estado no permitida: % -> %', old.estado, new.estado;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_set_updated_at on public.pedidos;
create trigger pedidos_set_updated_at before update on public.pedidos
for each row execute function public.viandapp_set_updated_at();

drop trigger if exists pedidos_validar_transicion_trigger on public.pedidos;
create trigger pedidos_validar_transicion_trigger before update on public.pedidos
for each row execute function public.pedidos_validar_transicion();

drop policy if exists "viandera ve sus propios pedidos" on public.pedidos;
create policy "viandera ve sus propios pedidos" on public.pedidos
for select to authenticated
using (vianderas_id in (select id from public.vianderas where user_id = auth.uid()));

drop policy if exists "viandera actualiza estado de sus propios pedidos" on public.pedidos;
create policy "viandera actualiza estado de sus propios pedidos" on public.pedidos
for update to authenticated
using (vianderas_id in (select id from public.vianderas where user_id = auth.uid()))
with check (vianderas_id in (select id from public.vianderas where user_id = auth.uid()));

drop policy if exists "viandera ve items de sus propios pedidos" on public.pedido_items;
create policy "viandera ve items de sus propios pedidos" on public.pedido_items
for select to authenticated
using (pedido_id in (
  select id from public.pedidos
  where vianderas_id in (select id from public.vianderas where user_id = auth.uid())
));

revoke all on table public.pedidos, public.pedido_items from public, anon, authenticated;
grant select on table public.pedidos, public.pedido_items to authenticated;
grant update (estado) on table public.pedidos to authenticated;
grant all on table public.pedidos, public.pedido_items to service_role;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pedido_resultado'
  ) then
    create type public.pedido_resultado as (
      ok boolean,
      pedido public.pedidos,
      cambios jsonb
    );
  end if;
end;
$$;

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
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  v_pedido public.pedidos;
  v_existente public.pedidos;
  v_cocina public.vianderas;
  v_adhesion public.puni_adhesiones;
  v_request_hash text;
  v_items_canonicos jsonb;
  v_items_validados jsonb := '[]'::jsonb;
  v_viandas_bloqueadas jsonb := '[]'::jsonb;
  v_cambios jsonb := '[]'::jsonb;
  v_costo_envio_real numeric;
  v_total numeric;
  v_item jsonb;
  v_fila record;
  v_vianda_id uuid;
  v_cantidad numeric;
  v_precio_esperado numeric;
begin
  -- Validación completa ANTES de cualquier lock. Separar los IF evita
  -- evaluar jsonb_array_length/casts sobre tipos incompatibles.
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_invalidos' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'items_invalidos' using errcode = 'P0001';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item->'vianda_id') is distinct from 'string'
       or jsonb_typeof(v_item->'cantidad') is distinct from 'number'
       or jsonb_typeof(v_item->'precio_esperado') is distinct from 'number' then
      raise exception 'items_invalidos' using errcode = 'P0001';
    end if;
    begin
      v_vianda_id := (v_item->>'vianda_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'items_invalidos' using errcode = 'P0001', hint = 'vianda_id debe ser UUID';
    end;
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio_esperado := (v_item->>'precio_esperado')::numeric;
    if v_cantidad::text in ('NaN', 'Infinity', '-Infinity')
       or v_cantidad < 1 or v_cantidad > 50 or trunc(v_cantidad) <> v_cantidad then
      raise exception 'cantidad_fuera_de_rango' using errcode = 'P0001';
    end if;
    if v_precio_esperado::text in ('NaN', 'Infinity', '-Infinity') or v_precio_esperado < 0 then
      raise exception 'precio_invalido' using errcode = 'P0001';
    end if;
    v_items_validados := v_items_validados || jsonb_build_array(jsonb_build_object(
      'vianda_id', v_vianda_id, 'cantidad', v_cantidad::integer,
      'precio_esperado', v_precio_esperado
    ));
  end loop;

  if (select count(distinct item->>'vianda_id') from jsonb_array_elements(v_items_validados) item)
     <> jsonb_array_length(v_items_validados) then
    raise exception 'items_duplicados' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or p_vianderas_id is null or p_acepta_marketing is null then
    raise exception 'pedido_invalido' using errcode = 'P0001';
  end if;
  if p_costo_envio_esperado is null or p_costo_envio_esperado < 0
     or p_costo_envio_esperado::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'costo_envio_invalido' using errcode = 'P0001';
  end if;

  select jsonb_agg(jsonb_build_object(
    'vianda_id', item->>'vianda_id', 'cantidad', (item->>'cantidad')::integer
  ) order by item->>'vianda_id') into v_items_canonicos
  from jsonb_array_elements(v_items_validados) item;

  -- El costo esperado sí identifica la solicitud; precios de ítems y
  -- totales calculados no. Normalizar escala numérica y UUIDs también.
  v_request_hash := md5(jsonb_build_object(
    'vianderas_id', p_vianderas_id,
    'modalidad', p_modalidad,
    'costo_envio_esperado', trim_scale(p_costo_envio_esperado),
    'items', v_items_canonicos,
    'nombre_comprador', trim(p_nombre_comprador),
    'telefono_comprador', trim(p_telefono_comprador),
    'direccion_envio', trim(coalesce(p_direccion_envio, '')),
    'acepta_marketing', p_acepta_marketing
  )::text);

  -- Serializa la misma key incluso antes de que exista una fila. Una
  -- colisión del hash de lock solo serializa keys distintas, no las mezcla.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existente from public.pedidos where idempotency_key = p_idempotency_key;
  if found then
    if v_existente.request_hash is distinct from v_request_hash then
      raise exception 'idempotency_key_content_mismatch' using errcode = 'P0001';
    end if;
    -- Reintentos exitosos conservan la captura original aunque cambie el catálogo.
    return (true, v_existente, '[]'::jsonb)::public.pedido_resultado;
  end if;

  -- Impide cambios de configuración durante la captura de modalidad/costo.
  select * into v_cocina from public.vianderas where id = p_vianderas_id for share;
  if p_modalidad = 'retiro' and v_cocina.ofrece_retiro then
    v_costo_envio_real := 0;
  elsif p_modalidad = 'envio_propio' and v_cocina.ofrece_envio then
    v_costo_envio_real := v_cocina.costo_envio_propio;
  elsif p_modalidad = 'envio_puni' then
    select * into v_adhesion from public.puni_adhesiones
    where viandera_id = p_vianderas_id for share;
    if v_adhesion.estado = 'aprobada' then
      v_costo_envio_real := v_adhesion.costo_envio_puni;
    end if;
  end if;
  if v_costo_envio_real is null or v_costo_envio_real < 0
     or v_costo_envio_real::text in ('NaN', 'Infinity', '-Infinity') then
    v_cambios := v_cambios || jsonb_build_array(jsonb_build_object(
      'tipo', 'modalidad_no_disponible', 'modalidad', p_modalidad
    ));
  elsif v_costo_envio_real <> p_costo_envio_esperado then
    v_cambios := v_cambios || jsonb_build_array(jsonb_build_object(
      'tipo', 'costo_envio_cambio', 'modalidad', p_modalidad,
      'costo_esperado', p_costo_envio_esperado, 'costo_actual', v_costo_envio_real
    ));
  end if;

  -- FOR UPDATE actúa sobre filas reales, sin agregación. Orden estable
  -- para pedidos que comparten platos. La captura se arma desde ese cursor.
  for v_fila in
    select v.id, v.nombre, v.precio, v.disponible from public.viandas v
    where v.vianderas_id = p_vianderas_id
      and v.id in (select (item->>'vianda_id')::uuid from jsonb_array_elements(v_items_validados) item)
    order by v.id for update of v
  loop
    v_viandas_bloqueadas := v_viandas_bloqueadas || jsonb_build_array(to_jsonb(v_fila));
  end loop;

  for v_item in select value from jsonb_array_elements(v_items_validados)
  loop
    select * into v_fila from jsonb_to_recordset(v_viandas_bloqueadas)
      as v(id uuid, nombre text, precio numeric, disponible boolean)
    where v.id = (v_item->>'vianda_id')::uuid;
    if not found or v_fila.disponible is not true or v_fila.nombre is null
       or v_fila.precio is null or v_fila.precio < 0
       or v_fila.precio::text in ('NaN', 'Infinity', '-Infinity') then
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object(
        'tipo', 'plato_no_disponible', 'vianda_id', v_item->>'vianda_id'
      ));
    elsif v_fila.precio <> (v_item->>'precio_esperado')::numeric then
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object(
        'tipo', 'precio_cambio', 'vianda_id', v_item->>'vianda_id',
        'precio_esperado', (v_item->>'precio_esperado')::numeric, 'precio_actual', v_fila.precio
      ));
    end if;
  end loop;

  if jsonb_array_length(v_cambios) > 0 then
    return (false, null, v_cambios)::public.pedido_resultado;
  end if;

  select sum(v.precio * (item->>'cantidad')::integer) + v_costo_envio_real
    into v_total
  from jsonb_array_elements(v_items_validados) item
  join jsonb_to_recordset(v_viandas_bloqueadas) as v(id uuid, precio numeric)
    on v.id = (item->>'vianda_id')::uuid;

  insert into public.pedidos (
    idempotency_key, request_hash, vianderas_id, modalidad,
    costo_envio_capturado, total, nombre_comprador, telefono_comprador,
    direccion_envio, acepta_marketing, consentimiento_marketing_en
  ) values (
    p_idempotency_key, v_request_hash, p_vianderas_id, p_modalidad,
    v_costo_envio_real, v_total, trim(p_nombre_comprador), trim(p_telefono_comprador),
    nullif(trim(coalesce(p_direccion_envio, '')), ''), p_acepta_marketing,
    case when p_acepta_marketing then now() else null end
  ) on conflict (idempotency_key) do nothing returning * into v_pedido;

  -- Defensa adicional ante inserciones del servicio fuera de esta RPC.
  if not found then
    select * into v_existente from public.pedidos where idempotency_key = p_idempotency_key;
    if not found then
      raise exception 'idempotency_retry_required' using errcode = '40001';
    end if;
    if v_existente.request_hash is distinct from v_request_hash then
      raise exception 'idempotency_key_content_mismatch' using errcode = 'P0001';
    end if;
    return (true, v_existente, '[]'::jsonb)::public.pedido_resultado;
  end if;

  insert into public.pedido_items (pedido_id, vianda_id, nombre_capturado, precio_capturado, cantidad)
  select v_pedido.id, v.id, v.nombre, v.precio, (item->>'cantidad')::integer
  from jsonb_array_elements(v_items_validados) item
  join jsonb_to_recordset(v_viandas_bloqueadas) as v(id uuid, nombre text, precio numeric)
    on v.id = (item->>'vianda_id')::uuid;

  return (true, v_pedido, '[]'::jsonb)::public.pedido_resultado;
end;
$$;

revoke all on function public.crear_pedido_atomico(uuid, uuid, text, numeric, jsonb, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.crear_pedido_atomico(uuid, uuid, text, numeric, jsonb, text, text, text, boolean)
  to service_role;

-- La aplicación provee HMAC-SHA256 de IP, sesión server-emitida o clave
-- global. No se almacena IP cruda ni se calcula HMAC sin secreto en SQL.
create table if not exists public.limite_solicitudes (
  clave text not null,
  ventana_inicio timestamptz not null,
  intentos integer not null default 1 check (intentos > 0),
  created_at timestamptz not null default now(),
  primary key (clave, ventana_inicio)
);
alter table public.limite_solicitudes enable row level security;
-- Sin policies: acceso exclusivamente del servicio.
revoke all on table public.limite_solicitudes from public, anon, authenticated;
grant all on table public.limite_solicitudes to service_role;

create or replace function public.registrar_intento_limite(p_clave text, p_ventana_inicio timestamptz)
returns integer language sql security invoker
set search_path = pg_catalog, public
as $$
  insert into public.limite_solicitudes (clave, ventana_inicio, intentos)
  values (p_clave, p_ventana_inicio, 1)
  on conflict (clave, ventana_inicio)
  do update set intentos = public.limite_solicitudes.intentos + 1
  returning intentos;
$$;

revoke all on function public.registrar_intento_limite(text, timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_intento_limite(text, timestamptz) to service_role;

commit;
