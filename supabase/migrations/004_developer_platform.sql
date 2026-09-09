create extension if not exists pgcrypto;

create table if not exists public.payment_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_last4 text not null,
  key_hash text not null unique,
  scopes text[] not null default array['payments:read','payments:write'],
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz
);

create index if not exists payment_api_keys_workspace_idx on public.payment_api_keys(workspace_id, created_at desc);
create index if not exists payment_api_keys_hash_idx on public.payment_api_keys(key_hash);

create table if not exists public.payment_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  url text not null,
  secret_hash text not null,
  events text[] not null default array['payment.success','payment.failed'],
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz
);

create index if not exists payment_webhook_endpoints_workspace_idx on public.payment_webhook_endpoints(workspace_id, created_at desc);

create table if not exists public.payment_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.payment_webhook_endpoints(id) on delete cascade,
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  event_type text not null,
  event_id text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  response_status integer,
  response_body text,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique(endpoint_id, event_id)
);

create index if not exists payment_webhook_deliveries_retry_idx on public.payment_webhook_deliveries(status, next_attempt_at);
create index if not exists payment_webhook_deliveries_workspace_idx on public.payment_webhook_deliveries(workspace_id, created_at desc);

create table if not exists public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_logs_workspace_idx on public.payment_audit_logs(workspace_id, created_at desc);

alter table public.payment_api_keys enable row level security;
alter table public.payment_webhook_endpoints enable row level security;
alter table public.payment_webhook_deliveries enable row level security;
alter table public.payment_audit_logs enable row level security;

create policy "owners can manage payment api keys" on public.payment_api_keys
  for all using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create policy "owners can manage payment webhook endpoints" on public.payment_webhook_endpoints
  for all using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create policy "owners can view payment webhook deliveries" on public.payment_webhook_deliveries
  for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create policy "owners can view payment audit logs" on public.payment_audit_logs
  for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create or replace function public.touch_payment_webhook_endpoint()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_webhook_endpoint_touch on public.payment_webhook_endpoints;
create trigger payment_webhook_endpoint_touch before update on public.payment_webhook_endpoints
for each row execute function public.touch_payment_webhook_endpoint();
