create index if not exists mpesa_callback_events_workspace_status_created_idx
  on public.mpesa_callback_events(workspace_id, status, created_at desc);

create index if not exists mpesa_callback_events_connection_created_idx
  on public.mpesa_callback_events(connection_id, created_at desc);

create index if not exists mpesa_connections_workspace_status_idx
  on public.mpesa_connections(workspace_id, connection_status, callback_status);

create or replace view public.mpesa_callback_health as
select
  c.id as connection_id,
  c.workspace_id,
  c.shortcode,
  c.account_type,
  c.environment,
  c.connection_status,
  c.callback_status,
  c.callback_verified_at,
  count(e.id) filter (where e.created_at >= now() - interval '24 hours') as callbacks_24h,
  count(e.id) filter (where e.created_at >= now() - interval '24 hours' and e.status = 'processed') as processed_24h,
  count(e.id) filter (where e.created_at >= now() - interval '24 hours' and e.status = 'failed') as failed_24h,
  count(e.id) filter (where e.created_at >= now() - interval '24 hours' and e.status = 'rejected') as rejected_24h,
  max(e.created_at) as last_callback_at,
  max(e.processed_at) as last_processed_at
from public.mpesa_connections c
left join public.mpesa_callback_events e on e.connection_id = c.id
where c.is_active = true
group by c.id, c.workspace_id, c.shortcode, c.account_type, c.environment,
  c.connection_status, c.callback_status, c.callback_verified_at;

create or replace view public.mpesa_workspace_callback_health as
select
  workspace_id,
  count(*) as active_connections,
  count(*) filter (where callback_status = 'verified') as verified_connections,
  count(*) filter (where connection_status = 'ready') as ready_connections,
  coalesce(sum(callbacks_24h), 0) as callbacks_24h,
  coalesce(sum(processed_24h), 0) as processed_24h,
  coalesce(sum(failed_24h), 0) as failed_24h,
  coalesce(sum(rejected_24h), 0) as rejected_24h,
  max(last_callback_at) as last_callback_at
from public.mpesa_callback_health
group by workspace_id;
