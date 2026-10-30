-- 017 Notification System — Ch10: queue decoupling, settings opt-out, rate limit, dedup, tracking, monitoring
-- Extends 007/008/016 with production-grade notification infra

-- Notification settings: per-workspace opt-in/out per channel + event_type (Ch10: notification settings table)
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  channel text not null check (channel in ('sms','email','whatsapp','push')),
  event_type text not null,
  enabled boolean not null default true,
  rate_limit_per_min integer not null default 10 check (rate_limit_per_min > 0 and rate_limit_per_min <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, channel, event_type)
);

-- Notification templates generalized (keep payment_sms_templates for compat, new table for multi-channel)
create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  channel text not null check (channel in ('sms','email','whatsapp','push')),
  event_type text not null,
  name text not null,
  content text not null,
  sender_id text,
  status text not null default 'active' check (status in ('active','disabled')),
  variables text[] not null default array['amount','reference','receipt','phone'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, channel, event_type, name)
);

-- Harden notification events as durable queue (Ch19: WAL-like, consumer groups, offsets)
-- Existing payment_notification_events becomes the persistent queue
alter table public.payment_notification_events
  add column if not exists dedup_key text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists last_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists template_id uuid references public.notification_templates(id) on delete set null,
  add column if not exists priority integer not null default 5 check (priority between 1 and 10),
  add column if not exists expires_at timestamptz not null default (now() + interval '14 days');

create unique index if not exists payment_notification_events_dedup_idx
  on public.payment_notification_events(workspace_id, dedup_key) where dedup_key is not null;

create index if not exists payment_notification_events_queue_idx
  on public.payment_notification_events(status, next_attempt_at, priority desc, created_at) where status in ('pending','failed');

create index if not exists payment_notification_events_channel_idx
  on public.payment_notification_events(workspace_id, channel, event_type);

-- Event tracking: delivery, open, click, engagement (Ch10: event tracking)
create table if not exists public.notification_event_tracking (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.payment_notification_events(id) on delete cascade,
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  event_type text not null check (event_type in ('queued','sent','delivered','failed','opened','clicked','bounced','skipped')),
  channel text not null,
  provider_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_event_tracking_notification_idx
  on public.notification_event_tracking(notification_id, created_at desc);
create index if not exists notification_event_tracking_workspace_idx
  on public.notification_event_tracking(workspace_id, created_at desc);

-- Queue monitoring: stats materialized view helper + per-workspace rate limit state
create table if not exists public.notification_rate_limit_state (
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  channel text not null,
  recipient text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (workspace_id, channel, recipient)
);

-- Update triggers
create or replace function public.touch_notification_settings() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists notification_settings_touch on public.notification_settings;
create trigger notification_settings_touch before update on public.notification_settings for each row execute function public.touch_notification_settings();

create or replace function public.touch_notification_templates() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists notification_templates_touch on public.notification_templates;
create trigger notification_templates_touch before update on public.notification_templates for each row execute function public.touch_notification_templates();

-- RLS
alter table public.notification_settings enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_event_tracking enable row level security;
alter table public.notification_rate_limit_state enable row level security;

drop policy if exists "owners can manage notification settings" on public.notification_settings;
create policy "owners can manage notification settings" on public.notification_settings
  for all using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

drop policy if exists "owners can manage notification templates" on public.notification_templates;
create policy "owners can manage notification templates" on public.notification_templates
  for all using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

drop policy if exists "owners can view notification tracking" on public.notification_event_tracking;
create policy "owners can view notification tracking" on public.notification_event_tracking
  for select using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

-- Seed default settings for existing workspaces (SMS payment.receipt enabled)
insert into public.notification_settings(workspace_id, channel, event_type, enabled, rate_limit_per_min)
select id, 'sms', 'payment.receipt', true, 10 from public.payment_workspaces
on conflict do nothing;
