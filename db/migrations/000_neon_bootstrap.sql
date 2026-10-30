-- Neon/PostgreSQL bootstrap.
--
-- The historical schema was written for Supabase. It uses auth.uid() in RLS
-- policies even though the standalone API connects directly as the database
-- owner and therefore bypasses RLS. Neon does not ship Supabase's auth schema,
-- so provide the minimal compatibility shim before the application migrations
-- run. No Supabase Auth token is issued or accepted by the API.

create extension if not exists pgcrypto;

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select 'service_role'::text
$$;

comment on schema auth is 'Compatibility shim for historical RLS policies. The API uses DATABASE_URL, not Supabase Auth.';
comment on function auth.uid() is 'Returns NULL because the API authorises workspace access in server code.';
