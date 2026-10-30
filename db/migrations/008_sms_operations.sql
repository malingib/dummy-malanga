create table if not exists public.payment_sms_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  name text not null,
  event_type text not null default 'payment.receipt',
  sender_id text not null default 'MobiWave',
  message text not null,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, name)
);

create index if not exists payment_sms_templates_workspace_idx
  on public.payment_sms_templates(workspace_id, created_at desc);

alter table public.payment_sms_templates enable row level security;

create policy "owners can manage payment sms templates" on public.payment_sms_templates
for all using (
  exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid())
) with check (
  exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid())
);

create or replace function public.touch_payment_sms_template()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_sms_template_touch on public.payment_sms_templates;
create trigger payment_sms_template_touch before update on public.payment_sms_templates
for each row execute function public.touch_payment_sms_template();
