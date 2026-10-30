alter table public.payment_webhook_endpoints
  add column if not exists secret_ciphertext text;

alter table public.payment_webhook_endpoints
  alter column secret_hash drop not null;

create index if not exists payment_webhook_endpoints_active_idx
  on public.payment_webhook_endpoints(workspace_id, status);
