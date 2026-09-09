create table if not exists public.mpesa_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  shortcode text not null,
  account_type text not null default 'paybill' check (account_type in ('paybill','till')),
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  credential_source text not null default 'merchant' check (credential_source in ('merchant','mobiwave')),
  consumer_key_encrypted text,
  consumer_secret_encrypted text,
  passkey_encrypted text,
  connection_status text not null default 'draft' check (connection_status in ('draft','verifying','verified','testing','ready','live','failed','suspended')),
  token_status text not null default 'unknown' check (token_status in ('unknown','healthy','expired','failed')),
  callback_status text not null default 'not_configured' check (callback_status in ('not_configured','registering','registered','verified','failed')),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  token_last_obtained_at timestamptz,
  callback_registered_at timestamptz,
  callback_verified_at timestamptz,
  last_tested_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, shortcode, environment)
);

create index if not exists mpesa_connections_workspace_idx
  on public.mpesa_connections(workspace_id, is_active, created_at desc);
create index if not exists mpesa_connections_shortcode_idx
  on public.mpesa_connections(shortcode, environment) where is_active = true;
create unique index if not exists mpesa_connections_one_primary_idx
  on public.mpesa_connections(workspace_id) where is_primary = true and is_active = true;

alter table public.mpesa_connections enable row level security;
create policy "owners can view mpesa connections" on public.mpesa_connections
for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));
create policy "owners can create mpesa connections" on public.mpesa_connections
for insert with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));
create policy "owners can update mpesa connections" on public.mpesa_connections
for update using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create table if not exists public.mpesa_callback_registrations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mpesa_connections(id) on delete cascade,
  confirmation_url text not null,
  validation_url text,
  response_type text not null default 'Completed',
  status text not null default 'pending' check (status in ('pending','registering','registered','verified','failed')),
  conversation_id text,
  originator_conversation_id text,
  safaricom_response jsonb,
  registered_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mpesa_callback_registrations_connection_idx
  on public.mpesa_callback_registrations(connection_id);

alter table public.mpesa_callback_registrations enable row level security;
create policy "owners can view mpesa callback registrations" on public.mpesa_callback_registrations
for select using (exists (select 1 from public.mpesa_connections c join public.payment_workspaces w on w.id = c.workspace_id where c.id = connection_id and w.owner_user_id = auth.uid()));

create table if not exists public.mpesa_callback_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.mpesa_connections(id) on delete set null,
  workspace_id uuid references public.payment_workspaces(id) on delete set null,
  event_type text not null,
  idempotency_key text,
  shortcode text,
  payload jsonb not null default '{}',
  status text not null default 'received' check (status in ('received','processed','duplicate','rejected','failed')),
  response_payload jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists mpesa_callback_events_connection_idx on public.mpesa_callback_events(connection_id, received_at desc);
create index if not exists mpesa_callback_events_workspace_idx on public.mpesa_callback_events(workspace_id, received_at desc);
create unique index if not exists mpesa_callback_events_idempotency_idx on public.mpesa_callback_events(idempotency_key) where idempotency_key is not null;

alter table public.mpesa_callback_events enable row level security;
create policy "owners can view mpesa callback events" on public.mpesa_callback_events
for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

alter table public.payment_transactions add column if not exists connection_id uuid references public.mpesa_connections(id) on delete set null;
create index if not exists payment_transactions_connection_idx on public.payment_transactions(connection_id, created_at desc);

insert into public.mpesa_connections (workspace_id, shortcode, environment, account_type, is_primary, connection_status, callback_status)
select w.id, w.shortcode, w.environment, 'paybill', true,
  case when w.status = 'live' then 'live' when w.status in ('sandbox_ready') then 'ready' else 'draft' end,
  'not_configured'
from public.payment_workspaces w
where w.shortcode is not null and w.shortcode <> ''
on conflict (workspace_id, shortcode, environment) do nothing;

update public.payment_transactions t
set connection_id = c.id
from public.mpesa_connections c
where t.connection_id is null
  and c.workspace_id = t.workspace_id;

create or replace function public.touch_mpesa_connection()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists mpesa_connection_updated_at on public.mpesa_connections;
create trigger mpesa_connection_updated_at before update on public.mpesa_connections
for each row execute function public.touch_mpesa_connection();

create or replace function public.touch_mpesa_callback_registration()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists mpesa_callback_registration_updated_at on public.mpesa_callback_registrations;
create trigger mpesa_callback_registration_updated_at before update on public.mpesa_callback_registrations
for each row execute function public.touch_mpesa_callback_registration();
