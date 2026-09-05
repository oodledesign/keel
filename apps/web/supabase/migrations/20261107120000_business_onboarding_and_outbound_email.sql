-- Business onboarding progress, outbound From toggles, Lite entitlement
-- grant on create, and Lite CRM modules (capped, not apps-only).
-- Apply this migration to production separately if deploys do not auto-run SQL.

-- ---------------------------------------------------------------------------
-- 1. accounts: onboarding progress + per-feature outbound email settings
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists business_onboarding_step text,
  add column if not exists business_onboarding_completed_at timestamptz,
  add column if not exists outbound_email_settings jsonb not null default '{
    "invoices": false,
    "proposals": false,
    "contracts": false,
    "portal_invites": false,
    "other": false
  }'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_business_onboarding_step_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_business_onboarding_step_check
      check (
        business_onboarding_step is null
        or business_onboarding_step in (
          'company', 'client', 'task', 'assistant', 'plan', 'done'
        )
      );
  end if;
end
$$;

comment on column public.accounts.business_onboarding_step is
  'Owner-only business setup wizard step. NULL = existing workspace, skip wizard.';
comment on column public.accounts.business_onboarding_completed_at is
  'When the owner finished company → client → task → Assistant → plan.';
comment on column public.accounts.outbound_email_settings is
  'Per-feature toggles for sending client email from a verified custom domain. Off = Ozer From.';

-- ---------------------------------------------------------------------------
-- 2. Align existing Lite seat cap (catalog = 2) and product id
-- ---------------------------------------------------------------------------
update public.account_plan_limits
set
  plan_product_id = 'ozer-business-lite',
  max_members = 2,
  max_active_clients = coalesce(max_active_clients, 3),
  max_invoices_per_month = coalesce(max_invoices_per_month, 5),
  max_open_tasks = coalesce(max_open_tasks, 20),
  max_bookings_per_month = coalesce(max_bookings_per_month, 5),
  max_portal_storage_bytes = coalesce(max_portal_storage_bytes, 262144000),
  meeting_coaching_enabled = false,
  updated_at = now()
where plan_family = 'business_lite'
   or plan_id = 'business-lite-free'
   or plan_product_id in ('keel-business-lite', 'ozer-business-lite');

-- ---------------------------------------------------------------------------
-- 3. Grant Lite entitlement + caps when a lite business row is created
--    (create_team_account lost this insert after later replacements)
-- ---------------------------------------------------------------------------
create or replace function public.grant_business_lite_on_business_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.type, '')) <> 'lite' then
    return new;
  end if;

  insert into public.account_entitlements (
    account_id,
    entitlement_key,
    source,
    updated_at
  )
  values (
    new.account_id,
    'workspace_business_lite',
    'onboard',
    now()
  )
  on conflict (account_id, entitlement_key) do nothing;

  insert into public.account_plan_limits (
    account_id,
    plan_product_id,
    plan_id,
    plan_family,
    max_members,
    max_active_clients,
    max_invoices_per_month,
    max_open_tasks,
    max_bookings_per_month,
    max_portal_storage_bytes,
    meeting_coaching_enabled,
    updated_at
  )
  values (
    new.account_id,
    'ozer-business-lite',
    'business-lite-free',
    'business_lite',
    2,
    3,
    5,
    20,
    5,
    262144000,
    false,
    now()
  )
  on conflict (account_id) do update set
    plan_product_id = excluded.plan_product_id,
    plan_id = excluded.plan_id,
    plan_family = excluded.plan_family,
    max_members = excluded.max_members,
    max_active_clients = excluded.max_active_clients,
    max_invoices_per_month = excluded.max_invoices_per_month,
    max_open_tasks = excluded.max_open_tasks,
    max_bookings_per_month = excluded.max_bookings_per_month,
    max_portal_storage_bytes = excluded.max_portal_storage_bytes,
    meeting_coaching_enabled = excluded.meeting_coaching_enabled,
    updated_at = excluded.updated_at
  where public.account_plan_limits.plan_family is null
     or public.account_plan_limits.plan_family = 'business_lite';

  return new;
end;
$$;

drop trigger if exists grant_business_lite_on_business_insert
  on public.businesses;

create trigger grant_business_lite_on_business_insert
after insert on public.businesses
for each row
execute function public.grant_business_lite_on_business_insert();

-- ---------------------------------------------------------------------------
-- 4. Lite seed includes capped CRM (clients / tasks / invoices / portal)
-- ---------------------------------------------------------------------------
create or replace function public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text default 'work',
  p_business_type text default 'other'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_space text;
  normalized_biz text;
  keys text[];
  k text;
begin
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  if normalized_space = 'family' then
    keys := array[
      'dashboard', 'tasks', 'jobs', 'calendar', 'meal_plan', 'shopping',
      'notes', 'members', 'settings'
    ];
  elsif normalized_space = 'community' then
    keys := array[
      'dashboard', 'schedule', 'tasks', 'notes', 'members', 'settings'
    ];
  elsif normalized_space = 'commercial-property' then
    keys := array[
      'dashboard', 'listings', 'pipeline', 'clients', 'properties',
      'requirements', 'viewings', 'proposals', 'leases', 'reports', 'docs',
      'tasks', 'notes', 'sops', 'team', 'settings'
    ];
  elsif normalized_space = 'building-surveyor' then
    keys := array[
      'dashboard', 'pipeline', 'clients', 'proposals', 'notes', 'docs',
      'tasks', 'team', 'settings'
    ];
  elsif normalized_space = 'property' or normalized_biz = 'property' then
    keys := array[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  elsif normalized_biz = 'lite' then
    keys := array[
      'dashboard', 'apps', 'settings', 'team',
      'clients', 'tasks', 'invoices', 'client_portal', 'notes'
    ];
  else
    keys := array[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'messages', 'finances', 'settings'
    ];
  end if;

  foreach k in array keys
  loop
    insert into public.account_module_settings (account_id, module_key, enabled)
    values (p_account_id, k, true)
    on conflict (account_id, module_key) do nothing;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
