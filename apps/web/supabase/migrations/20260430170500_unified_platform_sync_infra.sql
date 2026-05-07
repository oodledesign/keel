-- Staged migration infrastructure: legacy id maps + sync/drift tracking
--
-- RLS policies below reference public.is_super_admin() from
-- 20250302043537_mfa-rls-super-admin.sql. Remote pushes that use
-- `supabase db push --include-all` or a divergent migration history can apply
-- this file before the MFA migration; ensure helpers exist (idempotent — same
-- definitions as 20250302043537).

create or replace function public.is_aal2() returns boolean
    set search_path = '' as
$$
declare
    is_aal2 boolean;
begin
    select auth.jwt() ->> 'aal' = 'aal2' into is_aal2;

    return coalesce(is_aal2, false);
end
$$ language plpgsql;

grant execute on function public.is_aal2() to authenticated;

create or replace function public.is_super_admin() returns boolean
    set search_path = '' as
$$
declare
    is_super_admin boolean;
begin
    if not public.is_aal2() then
        return false;
    end if;

    select (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super-admin' into is_super_admin;

    return coalesce(is_super_admin, false);
end
$$ language plpgsql;

grant execute on function public.is_super_admin() to authenticated;

create schema if not exists platform_merge;

create table if not exists platform_merge.id_mappings (
  id bigserial primary key,
  source_app text not null check (source_app in ('keel', 'feedflow', 'rankly')),
  entity_type text not null,
  source_id text not null,
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_app, entity_type, source_id)
);

create index if not exists ix_platform_merge_id_mappings_target
  on platform_merge.id_mappings (entity_type, target_id);

create table if not exists platform_merge.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_app text not null check (source_app in ('keel', 'feedflow', 'rankly')),
  sync_mode text not null check (sync_mode in ('snapshot', 'incremental', 'dual_write')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text
);

create index if not exists ix_platform_merge_sync_runs_source_started
  on platform_merge.sync_runs (source_app, started_at desc);

create table if not exists platform_merge.drift_checks (
  id uuid primary key default gen_random_uuid(),
  source_app text not null check (source_app in ('keel', 'feedflow', 'rankly')),
  entity_type text not null,
  source_count bigint not null default 0,
  target_count bigint not null default 0,
  delta bigint not null default 0,
  sampled_equal boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists ix_platform_merge_drift_checks_source_checked
  on platform_merge.drift_checks (source_app, checked_at desc);

create or replace function platform_merge.start_sync(
  p_source_app text,
  p_sync_mode text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
begin
  insert into platform_merge.sync_runs (source_app, sync_mode, status)
  values (p_source_app, p_sync_mode, 'running')
  returning id into run_id;

  return run_id;
end;
$$;

create or replace function platform_merge.finish_sync(
  p_run_id uuid,
  p_status text,
  p_stats jsonb default '{}'::jsonb,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update platform_merge.sync_runs
  set
    status = p_status,
    stats = coalesce(p_stats, '{}'::jsonb),
    error = p_error,
    finished_at = now()
  where id = p_run_id;
end;
$$;

alter table platform_merge.id_mappings enable row level security;
alter table platform_merge.sync_runs enable row level security;
alter table platform_merge.drift_checks enable row level security;

drop policy if exists platform_merge_id_mappings_admin on platform_merge.id_mappings;
create policy platform_merge_id_mappings_admin
on platform_merge.id_mappings for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists platform_merge_sync_runs_admin on platform_merge.sync_runs;
create policy platform_merge_sync_runs_admin
on platform_merge.sync_runs for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists platform_merge_drift_checks_admin on platform_merge.drift_checks;
create policy platform_merge_drift_checks_admin
on platform_merge.drift_checks for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
