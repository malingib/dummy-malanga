create table if not exists public.mpesa_activation_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','reviewing','credentials_required','testing','ready','live','blocked','cancelled')),
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  requested_methods text[] not null default '{}',
  notes text,
  last_error text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists mpesa_activation_workspace_active_idx
  on public.mpesa_activation_requests(workspace_id)
  where status not in ('live','cancelled');

alter table public.mpesa_activation_requests enable row level security;
create policy "owners can view activation requests"
  on public.mpesa_activation_requests for select
  using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));
create policy "owners can create activation requests"
  on public.mpesa_activation_requests for insert
  with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));
create policy "owners can update activation requests"
  on public.mpesa_activation_requests for update
  using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create or replace function public.set_activation_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists mpesa_activation_updated_at on public.mpesa_activation_requests;
create trigger mpesa_activation_updated_at before update on public.mpesa_activation_requests
for each row execute function public.set_activation_updated_at();
