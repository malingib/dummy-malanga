create table if not exists public.payment_notification_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  transaction_id uuid references public.payment_transactions(id) on delete set null,
  channel text not null check (channel in ('sms','email','whatsapp')),
  event_type text not null,
  recipient text,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  provider_uid text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists payment_notification_events_workspace_idx
  on public.payment_notification_events(workspace_id, created_at desc);

create index if not exists payment_notification_events_transaction_idx
  on public.payment_notification_events(transaction_id, created_at desc);

alter table public.payment_notification_events enable row level security;

create policy "owners can view payment notification events" on public.payment_notification_events
for select using (
  exists (
    select 1 from public.payment_workspaces w
    where w.id = workspace_id and w.owner_user_id = auth.uid()
  )
);
