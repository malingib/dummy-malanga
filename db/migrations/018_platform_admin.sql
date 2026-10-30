-- Platform administration is a separate surface from merchant workspaces.
-- It uses its own server-side endpoints and a dedicated audit trail.

create table if not exists public.platform_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_name text not null,
  action text not null,
  target_type text,
  target_id text,
  workspace_id uuid references public.payment_workspaces(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_audit_created_idx
  on public.platform_admin_audit_logs (created_at desc);
create index if not exists platform_admin_audit_workspace_idx
  on public.platform_admin_audit_logs (workspace_id, created_at desc);

alter table public.platform_admin_audit_logs enable row level security;

revoke all on public.platform_admin_audit_logs from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.platform_admin_audit_logs from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.platform_admin_audit_logs from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on public.platform_admin_audit_logs to service_role';
  end if;
end $$;

create or replace view public.platform_admin_workspace_summaries as
select
  w.id,
  w.business_name,
  w.business_email,
  w.business_phone,
  w.industry,
  w.shortcode,
  w.account_format,
  w.environment,
  w.status,
  w.payment_methods,
  w.created_at,
  w.updated_at,
  coalesce(tx.transaction_count, 0)::bigint as transaction_count,
  coalesce(tx.success_count, 0)::bigint as success_count,
  coalesce(tx.failed_count, 0)::bigint as failed_count,
  coalesce(tx.pending_count, 0)::bigint as pending_count,
  coalesce(tx.volume, 0)::numeric(14,2) as volume,
  tx.last_payment_at,
  c.connection_status,
  c.callback_status,
  c.last_tested_at,
  a.status as activation_status,
  a.requested_at as activation_requested_at,
  coalesce(e.open_exceptions, 0)::bigint as open_exceptions
from public.payment_workspaces w
left join lateral (
  select
    count(*)::bigint as transaction_count,
    count(*) filter (where t.status = 'success')::bigint as success_count,
    count(*) filter (where t.status = 'failed')::bigint as failed_count,
    count(*) filter (where t.status = 'pending')::bigint as pending_count,
    coalesce(sum(t.amount) filter (where t.status = 'success'), 0)::numeric(14,2) as volume,
    max(t.created_at) as last_payment_at
  from public.payment_transactions t
  where t.workspace_id = w.id
) tx on true
left join lateral (
  select m.connection_status, m.callback_status, m.last_tested_at
  from public.mpesa_connections m
  where m.workspace_id = w.id
  order by m.is_primary desc, m.created_at asc
  limit 1
) c on true
left join lateral (
  select r.status, r.requested_at
  from public.mpesa_activation_requests r
  where r.workspace_id = w.id and r.status <> 'cancelled'
  order by r.requested_at desc
  limit 1
) a on true
left join lateral (
  select count(*)::bigint as open_exceptions
  from public.payment_reconciliation_exceptions e
  where e.workspace_id = w.id and e.status in ('open', 'in_review')
) e on true;

revoke all on public.platform_admin_workspace_summaries from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.platform_admin_workspace_summaries from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.platform_admin_workspace_summaries from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select on public.platform_admin_workspace_summaries to service_role';
  end if;
end $$;

create or replace function public.platform_admin_overview(p_days integer default 14)
returns jsonb
language sql
security definer
set search_path = public
as $$
with bounds as (
  select greatest(1, least(coalesce(p_days, 14), 90))::int as days
), ranges as (
  select
    days,
    now() - (days::text || ' days')::interval as current_start,
    now() - ((days * 2)::text || ' days')::interval as previous_start
  from bounds
), current_tx as (
  select t.*
  from public.payment_transactions t, ranges r
  where t.created_at >= r.current_start
), previous_tx as (
  select t.*
  from public.payment_transactions t, ranges r
  where t.created_at >= r.previous_start and t.created_at < r.current_start
), current_totals as (
  select
    count(*)::bigint as total,
    count(*) filter (where status = 'success')::bigint as success,
    count(*) filter (where status = 'failed')::bigint as failed,
    count(*) filter (where status = 'pending')::bigint as pending,
    count(*) filter (where status = 'reversed')::bigint as reversed,
    coalesce(sum(amount) filter (where status = 'success'), 0)::numeric(14,2) as volume
  from current_tx
), previous_totals as (
  select coalesce(sum(amount) filter (where status = 'success'), 0)::numeric(14,2) as volume
  from previous_tx
), merchant_totals as (
  select
    count(*)::bigint as total,
    count(*) filter (where status = 'live')::bigint as live,
    count(*) filter (where environment = 'sandbox')::bigint as sandbox,
    count(*) filter (where environment = 'production')::bigint as production,
    count(*) filter (where created_at >= (select current_start from ranges))::bigint as new_in_window
  from public.payment_workspaces
), day_series as (
  select d::date as day
  from ranges r, generate_series(current_date - (r.days - 1), current_date, interval '1 day') d
), payment_series as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(s.day, 'YYYY-MM-DD'),
    'label', to_char(s.day, 'DD Mon'),
    'volume', s.volume,
    'count', s.count,
    'success_rate', s.success_rate
  ) order by s.day), '[]'::jsonb) as data
  from (
    select
      d.day,
      coalesce(sum(t.amount) filter (where t.status = 'success'), 0)::numeric(14,2) as volume,
      count(t.id)::bigint as count,
      case when count(t.id) = 0 then 0 else round((count(t.id) filter (where t.status = 'success'))::numeric * 100 / count(t.id), 1) end as success_rate
    from day_series d
    left join current_tx t on t.created_at::date = d.day
    group by d.day
  ) s
), merchant_series as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(s.day, 'YYYY-MM-DD'),
    'label', to_char(s.day, 'DD Mon'),
    'value', s.count
  ) order by s.day), '[]'::jsonb) as data
  from (
    select d.day, count(w.id)::bigint as count
    from day_series d
    left join public.payment_workspaces w on w.created_at::date = d.day
    group by d.day
  ) s
), recent_merchants as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'business_name', m.business_name,
    'business_email', m.business_email,
    'shortcode', m.shortcode,
    'environment', m.environment,
    'status', m.status,
    'created_at', m.created_at,
    'transaction_count', m.transaction_count,
    'success_count', m.success_count,
    'failed_count', m.failed_count,
    'pending_count', m.pending_count,
    'volume', m.volume,
    'last_payment_at', m.last_payment_at,
    'connection_status', m.connection_status,
    'callback_status', m.callback_status,
    'activation_status', m.activation_status,
    'open_exceptions', m.open_exceptions
  ) order by m.created_at desc), '[]'::jsonb) as data
  from (
    select *
    from public.platform_admin_workspace_summaries
    order by created_at desc
    limit 6
  ) m
), activation_queue as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'workspace_id', r.workspace_id,
    'business_name', w.business_name,
    'shortcode', w.shortcode,
    'status', r.status,
    'environment', r.environment,
    'requested_methods', r.requested_methods,
    'notes', r.notes,
    'last_error', r.last_error,
    'requested_at', r.requested_at,
    'merchant_status', w.status
  ) order by r.requested_at asc), '[]'::jsonb) as data
  from (
    select *
    from public.mpesa_activation_requests
    where status not in ('live', 'cancelled')
    order by requested_at asc
    limit 6
  ) r
  join public.payment_workspaces w on w.id = r.workspace_id
), recent_exceptions as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'workspace_id', e.workspace_id,
    'business_name', w.business_name,
    'type', e.type,
    'severity', e.severity,
    'status', e.status,
    'title', e.title,
    'reason', e.reason,
    'amount', e.amount,
    'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb) as data
  from (
    select *
    from public.payment_reconciliation_exceptions
    where status in ('open', 'in_review')
    order by created_at desc
    limit 6
  ) e
  join public.payment_workspaces w on w.id = e.workspace_id
), queues as (
  select
    (select count(*)::bigint from public.payment_reconciliation_exceptions where status in ('open', 'in_review')) as open_exceptions,
    (select count(*)::bigint from public.payment_reconciliation_exceptions where status in ('open', 'in_review') and severity = 'critical') as critical_exceptions,
    (select count(*)::bigint from public.mpesa_activation_requests where status not in ('live', 'cancelled')) as activation_requests,
    (select count(*)::bigint from public.payment_webhook_deliveries where status = 'failed') as failed_webhooks,
    (select count(*)::bigint from public.payment_notification_events where channel = 'sms' and status = 'failed') as failed_notifications,
    (select min(requested_at) from public.mpesa_activation_requests where status not in ('live', 'cancelled')) as oldest_activation_at
)
select jsonb_build_object(
  'generated_at', now(),
  'window_days', r.days,
  'merchants', jsonb_build_object(
    'total', mt.total,
    'live', mt.live,
    'sandbox', mt.sandbox,
    'production', mt.production,
    'new_in_window', mt.new_in_window,
    'series', ms.data
  ),
  'payments', jsonb_build_object(
    'total', ct.total,
    'success', ct.success,
    'failed', ct.failed,
    'pending', ct.pending,
    'reversed', ct.reversed,
    'success_rate', case when ct.total = 0 then 0 else round(ct.success::numeric * 100 / ct.total, 1) end,
    'volume', ct.volume,
    'previous_volume', pt.volume,
    'volume_change', case when pt.volume = 0 then null else round((ct.volume - pt.volume) * 100.0 / pt.volume, 1) end,
    'series', ps.data
  ),
  'queues', jsonb_build_object(
    'open_exceptions', q.open_exceptions,
    'critical_exceptions', q.critical_exceptions,
    'activation_requests', q.activation_requests,
    'failed_webhooks', q.failed_webhooks,
    'failed_notifications', q.failed_notifications,
    'oldest_activation_at', q.oldest_activation_at
  ),
  'recent_merchants', rm.data,
  'activation_queue', aq.data,
  'recent_exceptions', re.data
)
from ranges r
cross join current_totals ct
cross join previous_totals pt
cross join merchant_totals mt
cross join queues q
cross join payment_series ps
cross join merchant_series ms
cross join recent_merchants rm
cross join activation_queue aq
cross join recent_exceptions re;
$$;

revoke all on function public.platform_admin_overview(integer) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.platform_admin_overview(integer) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.platform_admin_overview(integer) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.platform_admin_overview(integer) to service_role';
  end if;
end $$;

comment on table public.platform_admin_audit_logs is 'Append-only actions performed by platform administrators across merchant workspaces.';
comment on view public.platform_admin_workspace_summaries is 'Service-role-only merchant summary used by the platform admin console.';
comment on function public.platform_admin_overview(integer) is 'Service-role-only aggregate used by the platform admin overview.';
