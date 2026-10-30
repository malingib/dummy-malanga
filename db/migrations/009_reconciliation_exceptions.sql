create table if not exists public.payment_reconciliation_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  reconciliation_run_id uuid references public.payment_reconciliation_runs(id) on delete set null,
  transaction_id uuid references public.payment_transactions(id) on delete set null,
  type text not null check (type in ('unmatched','duplicate','amount_mismatch','missing_receipt','reversed','manual_review')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_review','resolved','ignored')),
  title text not null,
  reason text,
  amount numeric(14,2),
  assigned_to uuid,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_reconciliation_exceptions_workspace_status_idx
  on public.payment_reconciliation_exceptions(workspace_id, status, created_at desc);
create index if not exists payment_reconciliation_exceptions_transaction_idx
  on public.payment_reconciliation_exceptions(transaction_id);

alter table public.payment_reconciliation_exceptions enable row level security;
create policy "owners can view reconciliation exceptions"
  on public.payment_reconciliation_exceptions for select
  using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));
create policy "owners can manage reconciliation exceptions"
  on public.payment_reconciliation_exceptions for all
  using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create or replace function public.set_reconciliation_exception_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists reconciliation_exception_updated_at on public.payment_reconciliation_exceptions;
create trigger reconciliation_exception_updated_at before update on public.payment_reconciliation_exceptions
for each row execute function public.set_reconciliation_exception_updated_at();

create or replace function public.refresh_reconciliation_exceptions(p_workspace_id uuid, p_run_id uuid default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  insert into public.payment_reconciliation_exceptions
    (workspace_id, reconciliation_run_id, transaction_id, type, severity, status, title, reason, amount)
  select t.workspace_id, p_run_id, t.id,
    case when t.reconciliation_status = 'duplicate' then 'duplicate' else 'unmatched' end,
    case when t.reconciliation_status = 'duplicate' then 'high' else 'medium' end,
    'open',
    case when t.reconciliation_status = 'duplicate' then 'Duplicate transaction' else 'Unmatched payment' end,
    case when t.reconciliation_status = 'duplicate' then 'Duplicate transaction identifier detected.' else 'Successful or recorded payment has no M-Pesa receipt.' end,
    t.amount
  from public.payment_transactions t
  where t.workspace_id = p_workspace_id
    and t.reconciliation_status in ('unmatched','duplicate')
    and not exists (
      select 1 from public.payment_reconciliation_exceptions e
      where e.workspace_id = t.workspace_id and e.transaction_id = t.id and e.status in ('open','in_review')
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
