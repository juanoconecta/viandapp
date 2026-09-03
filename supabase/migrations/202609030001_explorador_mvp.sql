alter table public.vianderas
  add column if not exists barrio text,
  add column if not exists ofrece_retiro boolean not null default true,
  add column if not exists ofrece_envio boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.viandas
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vianderas_set_updated_at on public.vianderas;
create trigger vianderas_set_updated_at
before update on public.vianderas
for each row execute function public.set_updated_at();

drop trigger if exists viandas_set_updated_at on public.viandas;
create trigger viandas_set_updated_at
before update on public.viandas
for each row execute function public.set_updated_at();

create table if not exists public.eventos_analitica (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (nombre in (
    'explore_viewed', 'search_submitted', 'filter_applied',
    'profile_viewed', 'dish_selected', 'whatsapp_intent', 'whatsapp_clicked'
  )),
  viandera_id uuid references public.vianderas(id) on delete set null,
  vianda_id uuid references public.viandas(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.eventos_analitica enable row level security;
