-- Phase 5: dunning notification types, agency Connect billing tables.

-- Extend billing notification types for payment follow-ups.
alter table public.billing_notification_log
  drop constraint if exists billing_notification_log_notification_type_check;

alter table public.billing_notification_log
  add constraint billing_notification_log_notification_type_check
  check (
    notification_type in (
      'trial_ending_3d',
      'trial_ending_1d',
      'trial_ended',
      'payment_failed',
      'payment_reminder_3d',
      'payment_reminder_7d'
    )
  );

-- Agency Stripe Connect (legacy business_id path; workspace accounts use account_payment_settings).
create table if not exists public.agency_stripe (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  stripe_account_id text,
  stripe_account_email text,
  stripe_connect_enabled boolean not null default false,
  stripe_pay_now_enabled boolean not null default false,
  application_fee_percent numeric(5, 2) default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_stripe_stripe_account_id_idx
  on public.agency_stripe (stripe_account_id);

alter table public.agency_stripe enable row level security;

create policy agency_stripe_account_members on public.agency_stripe
  for all to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and public.has_role_on_account (b.account_id)
    )
    or public.is_super_admin ()
  )
  with check (
    exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and public.has_role_on_account (b.account_id)
    )
    or public.is_super_admin ()
  );

grant select, insert, update, delete on public.agency_stripe to authenticated;
grant all on public.agency_stripe to service_role;

-- Client subscriptions billed via agency Stripe Connect (client portal).
create table if not exists public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_org_id uuid references public.client_orgs (id) on delete set null,
  plan_name text,
  monthly_amount integer not null default 0,
  currency text not null default 'gbp',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'overdue', 'cancelled')),
  next_billing_date timestamptz,
  stripe_payment_link text,
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_subscriptions_business_id_idx
  on public.client_subscriptions (business_id);

create index if not exists client_subscriptions_client_org_id_idx
  on public.client_subscriptions (client_org_id);

create unique index if not exists client_subscriptions_stripe_subscription_id_idx
  on public.client_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.client_subscriptions enable row level security;

create policy client_subscriptions_workspace on public.client_subscriptions
  for all to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and public.has_role_on_account (b.account_id)
    )
    or public.is_super_admin ()
  )
  with check (
    exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and public.has_role_on_account (b.account_id)
    )
    or public.is_super_admin ()
  );

create policy client_subscriptions_client_portal_read on public.client_subscriptions
  for select to authenticated
  using (
    client_org_id is not null
    and exists (
      select 1
      from public.client_members cm
      where cm.client_org_id = client_subscriptions.client_org_id
        and cm.user_id = auth.uid ()
    )
  );

grant select, insert, update, delete on public.client_subscriptions to authenticated;
grant all on public.client_subscriptions to service_role;
