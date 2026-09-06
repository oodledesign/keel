-- Prod-safe Lite onboard grant + slug collision handling.
--
-- 20261031120000 collided (tier-caps vs workspace_form_mailing_list).
-- 20261107120000 collided (business onboarding vs workspace_form_submission_list).
-- This version is unique. Everything is idempotent so a partial prod apply is safe.
--
-- Apply this migration to production even if deploys do not auto-run SQL.

-- ---------------------------------------------------------------------------
-- 1. Ensure accounts onboarding columns exist
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists business_onboarding_step text,
  add column if not exists business_onboarding_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'outbound_email_settings'
  ) then
    alter table public.accounts
      add column outbound_email_settings jsonb not null default '{
        "invoices": false,
        "proposals": false,
        "contracts": false,
        "portal_invites": false,
        "other": false
      }'::jsonb;
  end if;
end
$$;

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

-- ---------------------------------------------------------------------------
-- 2. Ensure entitlement source allows onboard / backfill
-- ---------------------------------------------------------------------------
alter table public.account_entitlements
  drop constraint if exists account_entitlements_source_check;

alter table public.account_entitlements
  add constraint account_entitlements_source_check
  check (source in (
    'stripe',
    'admin_grant',
    'trial',
    'super_admin',
    'onboard',
    'backfill'
  ));

-- ---------------------------------------------------------------------------
-- 3. Ensure Lite plan-limit columns exist (collided 20261031120000)
-- ---------------------------------------------------------------------------
alter table public.account_plan_limits
  add column if not exists max_active_clients integer,
  add column if not exists max_invoices_per_month integer,
  add column if not exists max_open_tasks integer,
  add column if not exists max_bookings_per_month integer,
  add column if not exists max_portal_storage_bytes bigint,
  add column if not exists client_request_credit_allowance integer,
  add column if not exists meeting_coaching_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- 4. Lite grant must never abort businesses insert / create_team_account
-- ---------------------------------------------------------------------------
create or replace function public.grant_business_lite_on_business_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement_source text;
begin
  if lower(coalesce(new.type, '')) <> 'lite' then
    return new;
  end if;

  begin
    entitlement_source := 'onboard';
    insert into public.account_entitlements (
      account_id,
      entitlement_key,
      source,
      updated_at
    )
    values (
      new.account_id,
      'workspace_business_lite',
      entitlement_source,
      now()
    )
    on conflict (account_id, entitlement_key) do nothing;
  exception
    when check_violation then
      begin
        insert into public.account_entitlements (
          account_id,
          entitlement_key,
          source,
          updated_at
        )
        values (
          new.account_id,
          'workspace_business_lite',
          'admin_grant',
          now()
        )
        on conflict (account_id, entitlement_key) do nothing;
      exception
        when others then
          raise warning 'grant_business_lite entitlement failed: %', sqlerrm;
      end;
    when others then
      raise warning 'grant_business_lite entitlement failed: %', sqlerrm;
  end;

  begin
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
  exception
    when others then
      -- Missing cap columns or older plan_limits shape must not roll back
      -- create_team_account. Retry a minimal insert.
      begin
        insert into public.account_plan_limits (
          account_id,
          plan_product_id,
          plan_id,
          plan_family,
          max_members,
          updated_at
        )
        values (
          new.account_id,
          'ozer-business-lite',
          'business-lite-free',
          'business_lite',
          2,
          now()
        )
        on conflict (account_id) do update set
          plan_product_id = excluded.plan_product_id,
          plan_id = excluded.plan_id,
          plan_family = excluded.plan_family,
          max_members = excluded.max_members,
          updated_at = excluded.updated_at
        where public.account_plan_limits.plan_family is null
           or public.account_plan_limits.plan_family = 'business_lite';
      exception
        when others then
          raise warning 'grant_business_lite plan limits failed: %', sqlerrm;
      end;
  end;

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
-- 5. create_team_account: unique businesses.slug + set lite onboarding step
--    Same 6-arg signature (do not add params — PostgREST overload 300).
-- ---------------------------------------------------------------------------
create or replace function public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text default null,
  account_space_type text default 'work',
  account_business_type text default 'other',
  account_complete_onboarding boolean default false
)
returns public.accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_account public.accounts;
  owner_role varchar(50);
  normalized_space_type text;
  normalized_business_type text;
  store_space_type text;
  business_slug text;
  has_business_slug boolean;
  membership_onboarding_completed boolean;
  seed_business_type text;
begin
  if not public.is_set('enable_team_accounts') then
    raise exception 'Team accounts are not enabled';
  end if;

  membership_onboarding_completed := coalesce(account_complete_onboarding, false);

  normalized_space_type := lower(coalesce(account_space_type, 'work'));
  normalized_business_type := lower(coalesce(account_business_type, 'other'));

  if normalized_space_type not in (
    'work', 'family', 'community', 'property', 'commercial-property', 'building-surveyor'
  ) then
    raise exception
      'Invalid account_space_type. Expected work, family, community, property, commercial-property, or building-surveyor.';
  end if;

  if normalized_business_type not in ('design', 'property', 'other', 'lite') then
    raise exception 'Invalid account_business_type. Expected design, property, other, or lite.';
  end if;

  if normalized_space_type in ('work', 'property') then
    store_space_type := 'work';
  else
    store_space_type := normalized_space_type;
  end if;

  seed_business_type := case
    when normalized_business_type = 'lite' then 'lite'
    when normalized_space_type = 'property' or normalized_business_type = 'property' then 'property'
    when normalized_business_type = 'design' then 'design'
    else 'other'
  end;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'slug'
  ) into has_business_slug;

  select public.get_upper_system_role() into owner_role;

  insert into public.accounts (
    name,
    slug,
    is_personal_account,
    primary_owner_user_id,
    space_type
  )
  values (
    account_name,
    account_slug,
    false,
    user_id,
    store_space_type
  )
  returning * into new_account;

  insert into public.accounts_memberships (
    account_id,
    user_id,
    account_role,
    company_role,
    onboarding_step,
    onboarding_completed
  )
  values (
    new_account.id,
    user_id,
    coalesce(owner_role, 'owner'),
    'admin',
    1,
    membership_onboarding_completed
  );

  perform public.seed_account_module_settings(
    new_account.id,
    store_space_type,
    seed_business_type
  );

  if store_space_type = 'work' and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'businesses'
  ) then
    if not exists (
      select 1 from public.businesses b where b.account_id = new_account.id
    ) then
      business_slug := coalesce(
        nullif(trim(account_slug), ''),
        lower(regexp_replace(account_name, '[^a-zA-Z0-9]+', '-', 'g'))
      );

      if has_business_slug then
        if business_slug is null or btrim(business_slug) = '' then
          business_slug := 'workspace';
        end if;

        if exists (
          select 1 from public.businesses b where b.slug = business_slug
        ) then
          business_slug := business_slug || '-' || substring(
            replace((extensions.uuid_generate_v4())::text, '-', ''),
            1,
            8
          );
        end if;

        insert into public.businesses (account_id, name, type, slug, owner_id)
        values (
          new_account.id,
          account_name,
          seed_business_type,
          business_slug,
          user_id
        );
      else
        insert into public.businesses (account_id, name, type, owner_id)
        values (
          new_account.id,
          account_name,
          seed_business_type,
          user_id
        );
      end if;
    end if;
  end if;

  if seed_business_type = 'lite' then
    begin
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'accounts'
          and column_name = 'business_onboarding_step'
      ) then
        update public.accounts
        set business_onboarding_step = coalesce(business_onboarding_step, 'client')
        where id = new_account.id;

        select * into new_account
        from public.accounts
        where id = new_account.id;
      end if;
    exception
      when others then
        raise warning 'create_team_account onboarding step skipped: %', sqlerrm;
    end;
  end if;

  if store_space_type in ('family', 'community') then
    insert into public.groups (account_id, name, kind)
    select new_account.id, account_name,
      case when store_space_type = 'family' then 'family' else 'community' end
    where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'groups'
    )
    and not exists (
      select 1 from public.groups g where g.account_id = new_account.id
    );
  end if;

  return new_account;
end;
$$;

notify pgrst, 'reload schema';
