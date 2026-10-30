-- Make the payment ledger compatible with deterministic PostgREST upserts.
-- The original uniqueness index was partial; transaction_id is nullable, so a
-- normal unique index preserves the intended semantics while allowing NULLs.
drop index if exists public.payment_transactions_workspace_txn_idx;
create unique index if not exists payment_transactions_workspace_txn_unique_idx
  on public.payment_transactions(workspace_id, transaction_id);

-- Enforce that copied routing metadata cannot diverge from its connection.
create or replace function public.validate_payment_transaction_connection()
returns trigger
language plpgsql
as $$
declare
  v_shortcode text;
  v_account_type text;
  v_workspace_id uuid;
begin
  if new.connection_id is not null then
    select c.workspace_id, c.shortcode, c.account_type
      into v_workspace_id, v_shortcode, v_account_type
    from public.mpesa_connections c
    where c.id = new.connection_id;

    if v_workspace_id is null or v_workspace_id <> new.workspace_id then
      raise exception 'Payment connection does not belong to workspace';
    end if;

    if new.shortcode is not null and new.shortcode <> v_shortcode then
      raise exception 'Payment shortcode does not match connection';
    end if;

    if new.account_type is not null and new.account_type <> v_account_type then
      raise exception 'Payment account type does not match connection';
    end if;

    new.shortcode := v_shortcode;
    new.account_type := v_account_type;
  end if;

  return new;
end;
$$;

-- Re-attach the guard after replacing the function so every future insert/update
-- receives the same tenant + shortcode + account-type validation.
drop trigger if exists payment_transaction_connection_guard on public.payment_transactions;
create trigger payment_transaction_connection_guard
before insert or update on public.payment_transactions
for each row execute function public.validate_payment_transaction_connection();
