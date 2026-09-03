-- Explorador de consumidores — columnas nuevas en vianderas/viandas,
-- función y triggers de updated_at, tabla eventos_analitica.
--
-- Repetible sobre el esquema que este archivo espera (columnas/tabla ya
-- creadas por una corrida anterior de este mismo script): usa
-- `if not exists` / `create or replace` / `drop trigger if exists` +
-- `create trigger`. Eso NO reconcilia un objeto preexistente con un tipo,
-- default o constraint distinto al de acá abajo — si `vianderas.barrio`
-- ya existiera con otro tipo, por ejemplo, este script no lo corrige. Ver
-- las consultas de preflight en el plan (Task 8) antes de aplicar.
--
-- Reemplaza (no elimina) los dos triggers `vianderas_set_updated_at` y
-- `viandas_set_updated_at` vía `drop trigger if exists` + `create
-- trigger` — es la forma estándar de "crear o reemplazar" un trigger en
-- Postgres, que no tiene `create or replace trigger`. Ningún `drop` de
-- tabla, columna o fila en todo el script.
--
-- Todas las sentencias de acá abajo son DDL transaccional válido en
-- Postgres (ninguna es CREATE INDEX CONCURRENTLY, VACUUM, ni un ALTER
-- TYPE ... ADD VALUE que necesite su propia transacción), así que todo el
-- script corre atómico: si algo falla a mitad de camino, el ROLLBACK
-- implícito de la sesión deshace todo, no deja el esquema a medio migrar.

begin;

alter table public.vianderas
  add column if not exists barrio text,
  add column if not exists ofrece_retiro boolean not null default true,
  add column if not exists ofrece_envio boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.viandas
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.viandapp_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vianderas_set_updated_at on public.vianderas;
create trigger vianderas_set_updated_at
before update on public.vianderas
for each row execute function public.viandapp_set_updated_at();

drop trigger if exists viandas_set_updated_at on public.viandas;
create trigger viandas_set_updated_at
before update on public.viandas
for each row execute function public.viandapp_set_updated_at();

create table if not exists public.eventos_analitica (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (nombre in (
    'explore_viewed', 'search_submitted', 'filter_applied',
    'profile_viewed', 'dish_selected', 'whatsapp_intent', 'whatsapp_clicked'
  )),
  viandera_id uuid references public.vianderas(id) on delete set null,
  vianda_id uuid references public.viandas(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint eventos_analitica_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

alter table public.eventos_analitica enable row level security;

commit;
