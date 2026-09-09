-- Make shortcode/connection routing explicit on the merchant payment ledger.
alter table public.payment_transactions
  add column if not exists shortcode text,
  add column if not exists account_type text,
  add column if not exists callback_event_id uuid references public.mpesa_callback_events(id) on delete set null;

create index if not exists payment_transactions_shortcode_idx
  on public.payment_transactions(workspace_id, shortcode, created_at desc);
create index if not exists payment_transactions_callback_event_idx
  on public.payment_transactions(callback_event_id);

-- Backfill shortcode/account type from the connection already attached by 011.
update public.payment_transactions t
set shortcode = c.shortcode,
    account_type = c.account_type
from public.mpesa_connections c
where t.connection_id = c.id
  and (t.shortcode is null or t.account_type is null);

-- Keep connection routing tenant-safe at the database level.
create or replace function public.validate_payment_transaction_connection()
returns trigger
language plpgsql
as $$
begin
  if new.connection_id is not null then
    if not exists (
      select 1
      from public.mpesa_connections c
      where c.id = new.connection_id
        and c.workspace_id = new.workspace_id
    ) then
      raise exception 'Payment connection does not belong to workspace';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_transaction_connection_guard on public.payment_transactions;
create trigger payment_transaction_connection_guard
before insert or update on public.payment_transactions
for each row execute function public.validate_payment_transaction_connection();
