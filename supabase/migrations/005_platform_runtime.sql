create table if not exists public.payment_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  unique(workspace_id, idempotency_key)
);

create index if not exists payment_idempotency_workspace_created_idx on public.payment_idempotency_keys(workspace_id, created_at desc);
alter table public.payment_idempotency_keys enable row level security;
create policy "owners can view payment idempotency keys" on public.payment_idempotency_keys for select
using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create table if not exists public.payment_mpesa_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade unique,
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  shortcode text not null,
  credential_status text not null default 'missing' check (credential_status in ('missing','configured','verified')),
  callback_status text not null default 'not_configured' check (callback_status in ('not_configured','configured','verified')),
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_mpesa_connections enable row level security;
create policy "owners can manage mpesa connections" on public.payment_mpesa_connections for all
using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create index if not exists payment_mpesa_connections_workspace_idx on public.payment_mpesa_connections(workspace_id);
