-- CRM interno: contactos unificados (cocinas potenciales/activas,
-- consumidores con consentimiento, aliados estratégicos, otros), notas,
-- tareas, interacciones, y sincronización automática desde
-- interesados_viandera / vianderas / pedidos.
--
-- Escrita y revisada estáticamente; NO aplicada ni validada en Postgres.
-- Repetible sobre su propio esquema (if not exists / create or replace /
-- drop trigger if exists + create trigger); no reconcilia objetos
-- incompatibles ni hace drop de tablas, columnas o filas existentes.
--
-- Privacidad: crm_contactos nunca guarda una copia de PII de pedidos.
-- Los consumidores se vinculan solo cuando aceptan marketing
-- (acepta_marketing = true en pedidos), vía upsert idempotente sobre
-- contacto_normalizado. crm_contactos_resumen resuelve nombre/contacto
-- visibles uniendo únicamente vianderas e interesados_viandera — nunca
-- pedidos — para que un contacto anonimizado (pii_eliminada = true) no
-- pueda reconstruirse a través de la vista.
begin;

-- 1. Normalización de contacto libre (email o teléfono argentino) —
-- debe producir el mismo resultado que normalizarContacto() en
-- lib/crm/normalizarContacto.ts (Task 1) para todos los casos.
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

-- 2. crm_contactos: entidad central. Vinculado (viandera_id o
-- interesado_id) o libre (nombre_libre / contacto_libre), nunca ambos
-- vínculos a la vez. contacto_normalizado es una columna generada para
-- deduplicar consumidores sin guardar el valor libre dos veces.
create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'cocina_potencial','cocina_activa','consumidor','aliado_estrategico','otro'
  )),
  viandera_id uuid references public.vianderas(id) on delete restrict,
  interesado_id uuid references public.interesados_viandera(id) on delete restrict,
  nombre_libre text,
  contacto_libre text,
  contacto_normalizado text
    generated always as (public.crm_normalizar_contacto(contacto_libre)) stored,
  fuente text not null check (fuente in (
    'landing_interes','explorador','pedido','referido','contacto_directo','otro'
  )),
  estado text not null default 'nuevo' check (estado in (
    'nuevo','en_conversacion','calificado','activo','inactivo','descartado'
  )),
  etiquetas text[] not null default '{}',
  consentimiento_retirado_en timestamptz,
  pii_eliminada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contactos_un_solo_vinculo check (
    viandera_id is null or interesado_id is null
  ),
  constraint crm_contactos_libre_o_vinculado check (
    viandera_id is not null
    or interesado_id is not null
    or nombre_libre is not null
    or pii_eliminada = true
  ),
  constraint crm_contactos_anonimizacion_consistente check (
    pii_eliminada = false
    or (
      tipo = 'consumidor'
      and viandera_id is null
      and interesado_id is null
      and nombre_libre is null
      and contacto_libre is null
      and consentimiento_retirado_en is not null
    )
  )
);

-- 3. Tabla puente (un consumidor puede tener varios pedidos), notas,
-- tareas e interacciones — todas dependientes de crm_contactos.
create table if not exists public.crm_contacto_pedidos (
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contacto_id, pedido_id)
);

create table if not exists public.crm_notas (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_tareas (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  vence_en timestamptz,
  completada boolean not null default false,
  completada_en timestamptz,
  created_at timestamptz not null default now(),
  constraint crm_tareas_completada_consistente check (
    (completada = false and completada_en is null)
    or (completada = true and completada_en is not null)
  )
);

create table if not exists public.crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  tipo text not null check (tipo in (
    'llamada','whatsapp','email','reunion','cambio_estado','otro'
  )),
  resumen text not null check (char_length(resumen) between 1 and 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_interacciones_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

-- 4. Índices únicos parciales. viandera_unico / interesado_unico son
-- load-bearing: los triggers de sincronización de más abajo usan
-- on conflict (viandera_id) / (interesado_id) where ... is not null, y
-- Postgres requiere un índice único que matchee exactamente esa cláusula
-- para poder resolver el conflicto.
create unique index if not exists crm_contactos_viandera_unico
  on public.crm_contactos (viandera_id) where viandera_id is not null;

create unique index if not exists crm_contactos_interesado_unico
  on public.crm_contactos (interesado_id) where interesado_id is not null;

create unique index if not exists crm_contactos_consumidor_unico
  on public.crm_contactos (tipo, contacto_normalizado)
  where tipo = 'consumidor' and contacto_normalizado is not null;

-- 5. RLS habilitado en las cinco tablas nuevas. Sin policies: todo el
-- acceso pasa por server-side con service role (el panel /admin), igual
-- que limite_solicitudes en la migración de Carrito/Pedidos.
alter table public.crm_contactos enable row level security;
alter table public.crm_contacto_pedidos enable row level security;
alter table public.crm_notas enable row level security;
alter table public.crm_tareas enable row level security;
alter table public.crm_interacciones enable row level security;

-- 6. updated_at automático en crm_contactos, reutilizando la función
-- existente de la migración del explorador.
drop trigger if exists crm_contactos_set_updated_at on public.crm_contactos;
create trigger crm_contactos_set_updated_at before update on public.crm_contactos
for each row execute function public.viandapp_set_updated_at();

-- 7. Sincronización automática: cada interesada/viandera nueva entra al
-- CRM como cocina_potencial / cocina_activa. Los pedidos con
-- acepta_marketing = true vinculan (o reactivan) un contacto consumidor.
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

drop trigger if exists crm_vincular_pedido_consentido_trigger on public.pedidos;
create trigger crm_vincular_pedido_consentido_trigger
after insert on public.pedidos
for each row execute function public.crm_vincular_pedido_consentido();

-- 8. Vista de lectura para el panel: resuelve nombre/contacto visibles
-- sin nunca unir pedidos, para que un contacto anonimizado o sin
-- consentimiento vinculado no pueda reconstruirse a través de la vista.
create or replace view public.crm_contactos_resumen
with (security_invoker = true) as
select
  c.id,
  c.tipo,
  c.fuente,
  c.estado,
  c.etiquetas,
  c.consentimiento_retirado_en,
  c.pii_eliminada,
  case when c.pii_eliminada then null
    else coalesce(v.nombre, i.nombre, c.nombre_libre)
  end as nombre,
  case when c.pii_eliminada then null
    else coalesce(v.telefono, i.contacto, c.contacto_libre)
  end as contacto,
  c.created_at,
  c.updated_at
from public.crm_contactos c
left join public.vianderas v on v.id = c.viandera_id
left join public.interesados_viandera i on i.id = c.interesado_id;

commit;
