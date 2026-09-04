-- Envíos a nivel de cocina + adhesión administrada a Puni.
-- puni_adhesiones queda totalmente privada por RLS: no tiene policies.
-- Aditiva, repetible, transaccional.

begin;

alter table public.vianderas
  add column if not exists costo_envio_propio numeric check (costo_envio_propio >= 0),
  add column if not exists cobertura_envio text;

create table if not exists public.puni_adhesiones (
  id uuid primary key default gen_random_uuid(),
  viandera_id uuid not null references public.vianderas(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','rechazada','suspendida','revocada')),
  costo_envio_puni numeric check (costo_envio_puni >= 0),
  solicitado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por text,
  nota_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viandera_id)
);

alter table public.puni_adhesiones enable row level security;
-- Sin ninguna policy: toda operación pasa por createAdminClient() desde
-- Server Actions que verifican ownership o autorización en código.

drop trigger if exists puni_adhesiones_set_updated_at on public.puni_adhesiones;
create trigger puni_adhesiones_set_updated_at
before update on public.puni_adhesiones
for each row execute function public.viandapp_set_updated_at();

commit;
