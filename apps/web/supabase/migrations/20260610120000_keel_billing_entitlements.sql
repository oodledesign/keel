-- Keel workspace billing: entitlements, exemptions, and plan limits.

create table if not exists public.account_entitlements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  entitlement_key text not null,
  source text not null default 'stripe'
    check (source in ('stripe', 'admin_grant', 'trial', 'super_admin')),
  granted_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  stripe_subscription_id text,
  stripe_variant_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, entitlement_key)
);

create index if not exists account_entitlements_account_id_idx
  on public.account_entitlements (account_id);

create table if not exists public.account_billing_exempt (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  reason text,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.account_plan_limits (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  plan_product_id text,
  plan_id text,
  plan_family text,
  max_members integer,
  max_properties integer,
  max_videos integer,
  updated_at timestamptz not null default now()
);

alter table public.account_entitlements enable row level security;
alter table public.account_billing_exempt enable row level security;
alter table public.account_plan_limits enable row level security;

-- Members can read entitlements/limits for their workspaces.
create policy account_entitlements_read on public.account_entitlements
  for select to authenticated
  using (
    public.has_role_on_account (account_id)
    or public.is_super_admin ()
  );

create policy account_billing_exempt_read on public.account_billing_exempt
  for select to authenticated
  using (
    public.has_role_on_account (account_id)
    or public.is_super_admin ()
  );

create policy account_plan_limits_read on public.account_plan_limits
  for select to authenticated
  using (
    public.has_role_on_account (account_id)
    or public.is_super_admin ()
  );

-- Super admins manage grants (Phase 1 admin UI in Phase 3; API uses service role meanwhile).
create policy account_entitlements_super_admin on public.account_entitlements
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

create policy account_billing_exempt_super_admin on public.account_billing_exempt
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

create policy account_plan_limits_super_admin on public.account_plan_limits
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

grant select on public.account_entitlements to authenticated;
grant select on public.account_billing_exempt to authenticated;
grant select on public.account_plan_limits to authenticated;

grant all on public.account_entitlements to service_role;
grant all on public.account_billing_exempt to service_role;
grant all on public.account_plan_limits to service_role;
