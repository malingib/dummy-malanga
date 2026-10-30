-- 016 Payment Ledger (Ch26 double-entry) + B2C payouts + channel routing + retention
-- Implements MobiPay ledger hardening per docs/MOBIPAY_SYSTEM_DESIGN_REVIEW.md

-- Channel routing: allow workspace to route via specific shortcode/channel (Palpluss-style)
alter table public.payment_workspaces
  add column if not exists default_channel text,
  add column if not exists allowed_channels text[] not null default array['paybill']::text[];

-- Double-entry ledger (Ch26): every money movement has debit+credit legs summing to 0
create table if not exists public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  transaction_id uuid references public.payment_transactions(id) on delete set null,
  event_type text not null check (event_type in ('payin','payout','refund','reversal','fee')),
  account text not null check (account in ('buyer','merchant','platform','psp_settlement','fees')),
  entry_type text not null check (entry_type in ('debit','credit')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'KES',
  reference text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(workspace_id, idempotency_key, account, entry_type)
);

create index if not exists payment_ledger_workspace_txn_idx on public.payment_ledger(workspace_id, transaction_id);
create index if not exists payment_ledger_workspace_created_idx on public.payment_ledger(workspace_id, created_at desc);
create index if not exists payment_ledger_idempotency_idx on public.payment_ledger(idempotency_key);

-- B2C payouts (Ch26 pay-out flow, gated by PSP boundary)
create table if not exists public.b2c_payouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  phone_number text not null,
  amount numeric(14,2) not null check (amount > 0 and amount <= 150000),
  reference text not null,
  command_id text not null default 'BusinessPayment',
  status text not null default 'pending' check (status in ('pending','queued','success','failed')),
  transaction_id text,
  mpesa_transaction_id text,
  result_code text,
  result_desc text,
  idempotency_key text not null,
  raw_request jsonb,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, idempotency_key)
);

create index if not exists b2c_payouts_workspace_created_idx on public.b2c_payouts(workspace_id, created_at desc);
create index if not exists b2c_payouts_status_idx on public.b2c_payouts(status);

-- Retention: Ch19 message retention 2 weeks, Ch20 observability
-- Add retention metadata for webhook deliveries and notification events (auto-cleanup via cron)
alter table public.payment_webhook_deliveries add column if not exists expires_at timestamptz not null default (now() + interval '14 days');
alter table public.payment_notification_events add column if not exists expires_at timestamptz not null default (now() + interval '14 days');
alter table public.payment_webhook_events add column if not exists expires_at timestamptz not null default (now() + interval '14 days');

-- Helper to create double-entry for a successful payin
create or replace function public.create_ledger_entries_for_payin(p_txn_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_amt numeric(14,2); v_ref text; v_key text;
begin
  select workspace_id, amount, reference, transaction_id into v_ws, v_amt, v_ref, v_key from public.payment_transactions where id = p_txn_id;
  if v_ws is null or v_amt is null then return; end if;
  -- Idempotency: skip if already exists
  if exists (select 1 from public.payment_ledger where workspace_id = v_ws and idempotency_key = coalesce(v_key, p_txn_id::text)) then return; end if;
  insert into public.payment_ledger(workspace_id, transaction_id, event_type, account, entry_type, amount, reference, idempotency_key)
  values
    (v_ws, p_txn_id, 'payin', 'buyer', 'debit', v_amt, v_ref, coalesce(v_key, p_txn_id::text)),
    (v_ws, p_txn_id, 'payin', 'merchant', 'credit', v_amt, v_ref, coalesce(v_key, p_txn_id::text))
  on conflict do nothing;
end; $$;

-- RLS
alter table public.payment_ledger enable row level security;
alter table public.b2c_payouts enable row level security;

drop policy if exists "owners can view payment ledger" on public.payment_ledger;
create policy "owners can view payment ledger" on public.payment_ledger for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

drop policy if exists "owners can view b2c payouts" on public.b2c_payouts;
create policy "owners can view b2c payouts" on public.b2c_payouts for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));
