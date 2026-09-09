create extension if not exists pgcrypto;

create table if not exists public.payment_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid null,
  business_name text not null,
  business_phone text not null,
  business_email text not null,
  industry text,
  payment_methods text[] not null default '{}',
  shortcode text not null,
  account_format text not null default 'invoice',
  notification_sms boolean not null default true,
  notification_email boolean not null default true,
  notification_whatsapp boolean not null default false,
  developer_webhook boolean not null default true,
  webhook_url text,
  status text not null default 'draft' check (status in ('draft','ready_for_credentials','sandbox_ready','live')),
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_workspaces_owner_shortcode_idx
  on public.payment_workspaces (owner_user_id, shortcode)
  where owner_user_id is not null;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  transaction_id text,
  transaction_type text not null default 'c2b',
  phone_number text,
  amount numeric(14,2) not null check (amount > 0),
  reference text,
  status text not null default 'pending' check (status in ('pending','success','failed','reversed')),
  mpesa_receipt text,
  result_code text,
  result_description text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_transactions_workspace_txn_idx
  on public.payment_transactions(workspace_id, transaction_id)
  where transaction_id is not null;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.payment_workspaces(id) on delete set null,
  event_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_payment_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists payment_workspaces_updated_at on public.payment_workspaces;
create trigger payment_workspaces_updated_at before update on public.payment_workspaces
for each row execute function public.set_payment_updated_at();

drop trigger if exists payment_transactions_updated_at on public.payment_transactions;
create trigger payment_transactions_updated_at before update on public.payment_transactions
for each row execute function public.set_payment_updated_at();

alter table public.payment_workspaces enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy "owners can view payment workspaces" on public.payment_workspaces
for select using (owner_user_id = auth.uid());
create policy "owners can create payment workspaces" on public.payment_workspaces
for insert with check (owner_user_id = auth.uid());
create policy "owners can update payment workspaces" on public.payment_workspaces
for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "owners can view payment transactions" on public.payment_transactions
for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));
