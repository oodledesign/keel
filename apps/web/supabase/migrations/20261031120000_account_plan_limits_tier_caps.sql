-- Additive Free/Starter/Pro usage-cap columns on account_plan_limits.
-- NULL on integer/bigint columns = unlimited / not enforced (same convention as
-- max_members, max_properties, max_videos, max_project_guests).
-- Do not populate plan-specific values here — later prompts set those once
-- tier mapping is confirmed.

alter table public.account_plan_limits
  add column if not exists max_active_clients integer,
  add column if not exists max_invoices_per_month integer,
  add column if not exists max_open_tasks integer,
  add column if not exists max_bookings_per_month integer,
  add column if not exists max_portal_storage_bytes bigint,
  add column if not exists client_request_credit_allowance integer,
  add column if not exists meeting_coaching_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_plan_limits_max_active_clients_nonneg'
      and conrelid = 'public.account_plan_limits'::regclass
  ) then
    alter table public.account_plan_limits
      add constraint account_plan_limits_max_active_clients_nonneg
      check (max_active_clients is null or max_active_clients >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_plan_limits_max_invoices_per_month_nonneg'
      and conrelid = 'public.account_plan_limits'::regclass
  ) then
    alter table public.account_plan_limits
      add constraint account_plan_limits_max_invoices_per_month_nonneg
      check (max_invoices_per_month is null or max_invoices_per_month >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_plan_limits_max_open_tasks_nonneg'
      and conrelid = 'public.account_plan_limits'::regclass
  ) then
    alter table public.account_plan_limits
      add constraint account_plan_limits_max_open_tasks_nonneg
      check (max_open_tasks is null or max_open_tasks >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_plan_limits_max_bookings_per_month_nonneg'
      and conrelid = 'public.account_plan_limits'::regclass
  ) then
    alter table public.account_plan_limits
      add constraint account_plan_limits_max_bookings_per_month_nonneg
      check (max_bookings_per_month is null or max_bookings_per_month >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_plan_limits_max_portal_storage_bytes_nonneg'
      and conrelid = 'public.account_plan_limits'::regclass
  ) then
    alter table public.account_plan_limits
      add constraint account_plan_limits_max_portal_storage_bytes_nonneg
      check (max_portal_storage_bytes is null or max_portal_storage_bytes >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_plan_limits_client_request_credit_allowance_nonneg'
      and conrelid = 'public.account_plan_limits'::regclass
  ) then
    alter table public.account_plan_limits
      add constraint account_plan_limits_client_request_credit_allowance_nonneg
      check (
        client_request_credit_allowance is null
        or client_request_credit_allowance >= 0
      );
  end if;
end $$;

comment on column public.account_plan_limits.max_active_clients is
  'Max active clients for the workspace; NULL = unlimited / not enforced.';

comment on column public.account_plan_limits.max_invoices_per_month is
  'Max invoices creatable per calendar month; NULL = unlimited / not enforced.';

comment on column public.account_plan_limits.max_open_tasks is
  'Max open (incomplete) tasks; NULL = unlimited / not enforced.';

comment on column public.account_plan_limits.max_bookings_per_month is
  'Max scheduling bookings per calendar month; NULL = unlimited / not enforced.';

comment on column public.account_plan_limits.max_portal_storage_bytes is
  'Max client portal storage in bytes; NULL = unlimited / not enforced.';

comment on column public.account_plan_limits.client_request_credit_allowance is
  'Monthly client-request credit allotment. NULL semantics set in populate_free_pro_plan_limits migration (zero / not available — not unlimited).';

comment on column public.account_plan_limits.meeting_coaching_enabled is
  'When true, meeting coaching and auto task extraction are included.';
