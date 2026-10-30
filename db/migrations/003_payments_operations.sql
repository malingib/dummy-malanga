create table if not exists public.payment_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.payment_workspaces(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'completed' check (status in ('running','completed','failed')),
  transaction_count integer not null default 0,
  matched_count integer not null default 0,
  unmatched_count integer not null default 0,
  duplicate_count integer not null default 0,
  total_amount numeric(14,2) not null default 0,
  matched_amount numeric(14,2) not null default 0,
  unmatched_amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.payment_transactions
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciliation_status text not null default 'unreconciled'
    check (reconciliation_status in ('unreconciled','matched','unmatched','duplicate','manual')),
  add column if not exists settlement_reference text;

create index if not exists payment_transactions_workspace_created_idx
  on public.payment_transactions(workspace_id, created_at desc);
create index if not exists payment_transactions_workspace_status_idx
  on public.payment_transactions(workspace_id, status);
create index if not exists payment_transactions_workspace_reference_idx
  on public.payment_transactions(workspace_id, reference);
create index if not exists payment_transactions_workspace_receipt_idx
  on public.payment_transactions(workspace_id, mpesa_receipt);
create index if not exists payment_reconciliation_runs_workspace_created_idx
  on public.payment_reconciliation_runs(workspace_id, created_at desc);

alter table public.payment_reconciliation_runs enable row level security;
create policy "owners can view payment reconciliation runs"
  on public.payment_reconciliation_runs for select
  using (exists (select 1 from public.payment_workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

create or replace function public.reconcile_payment_workspace(
  p_workspace_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_matched integer;
  v_unmatched integer;
  v_duplicates integer;
  v_total numeric(14,2);
  v_matched_amount numeric(14,2);
  v_unmatched_amount numeric(14,2);
  v_run uuid;
begin
  update public.payment_transactions t
  set reconciliation_status = case
    when t.transaction_id is not null and exists (
      select 1 from public.payment_transactions d
      where d.workspace_id = t.workspace_id
        and d.transaction_id = t.transaction_id
        and d.id <> t.id
    ) then 'duplicate'
    when t.status = 'success' and t.mpesa_receipt is not null then 'matched'
    when t.status = 'success' then 'unmatched'
    else 'unmatched'
  end,
  reconciled_at = now()
  where t.workspace_id = p_workspace_id
    and t.created_at >= p_period_start
    and t.created_at < p_period_end;

  select count(*), coalesce(sum(amount),0),
    count(*) filter (where reconciliation_status = 'matched'),
    count(*) filter (where reconciliation_status = 'unmatched'),
    count(*) filter (where reconciliation_status = 'duplicate'),
    coalesce(sum(amount) filter (where reconciliation_status = 'matched'),0),
    coalesce(sum(amount) filter (where reconciliation_status = 'unmatched'),0)
  into v_count, v_total, v_matched, v_unmatched, v_duplicates, v_matched_amount, v_unmatched_amount
  from public.payment_transactions
  where workspace_id = p_workspace_id
    and created_at >= p_period_start
    and created_at < p_period_end;

  insert into public.payment_reconciliation_runs (
    workspace_id, period_start, period_end, status, transaction_count,
    matched_count, unmatched_count, duplicate_count, total_amount,
    matched_amount, unmatched_amount, completed_at
  ) values (
    p_workspace_id, p_period_start, p_period_end, 'completed', v_count,
    v_matched, v_unmatched, v_duplicates, v_total,
    v_matched_amount, v_unmatched_amount, now()
  ) returning id into v_run;

  return jsonb_build_object(
    'run_id', v_run,
    'transaction_count', v_count,
    'matched_count', v_matched,
    'unmatched_count', v_unmatched,
    'duplicate_count', v_duplicates,
    'total_amount', v_total,
    'matched_amount', v_matched_amount,
    'unmatched_amount', v_unmatched_amount
  );
end;
$$;
