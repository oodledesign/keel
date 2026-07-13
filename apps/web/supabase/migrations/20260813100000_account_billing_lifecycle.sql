-- Ozer SaaS billing lifecycle state (separate from MakerKit Stripe sync tables
-- and from Stripe Connect / client_subscriptions).
--
-- Does NOT alter MakerKit public.accounts or public.subscription_status.
-- Uses a new enum public.account_billing_status and table public.account_billing.

-- ---------------------------------------------------------------------------
-- Enum: Ozer lifecycle statuses (two-tier past_due + trial_expired + suspended)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'account_billing_status' and n.nspname = 'public'
  ) then
    create type public.account_billing_status as enum (
      'trialing',
      'active',
      'past_due_grace',
      'past_due_restricted',
      'suspended',
      'trial_expired',
      'canceled'
    );
  end if;
end $$;

comment on type public.account_billing_status is
  'Ozer SaaS billing lifecycle. Distinct from MakerKit public.subscription_status (Stripe mirror).';

-- ---------------------------------------------------------------------------
-- account_billing — per-workspace SaaS billing state
-- ---------------------------------------------------------------------------
create table if not exists public.account_billing (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  subscription_status public.account_billing_status,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  grace_period_ends_at timestamptz,
  restricted_at timestamptz,
  suspended_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.account_billing is
  'Ozer SaaS subscription lifecycle for a workspace (trial / grace / restricted / suspended). Stripe Connect client billing stays in agency_stripe / client_subscriptions.';

comment on column public.account_billing.subscription_status is
  'Ozer lifecycle status (account_billing_status), not MakerKit subscription_status.';

comment on column public.account_billing.stripe_customer_id is
  'Stripe Customer on Ozer platform account (cus_…). Mirrors billing_customers.customer_id when present.';

comment on column public.account_billing.stripe_subscription_id is
  'Stripe Subscription on Ozer platform account (sub_…). Mirrors subscriptions.id when present.';

comment on column public.account_billing.grace_period_ends_at is
  'End of past_due_grace — full access retained while Stripe retries.';

comment on column public.account_billing.restricted_at is
  'When status moved to past_due_restricted (read-only / limited access).';

comment on column public.account_billing.suspended_at is
  'When status moved to suspended (access blocked, data retained).';

comment on column public.account_billing.canceled_at is
  'When status moved to canceled (user-initiated or post-suspension retention expiry).';

create unique index if not exists account_billing_stripe_customer_id_uidx
  on public.account_billing (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists account_billing_stripe_subscription_id_uidx
  on public.account_billing (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists account_billing_subscription_status_idx
  on public.account_billing (subscription_status);

create index if not exists account_billing_trial_ends_at_idx
  on public.account_billing (trial_ends_at)
  where trial_ends_at is not null;

drop trigger if exists account_billing_set_timestamps on public.account_billing;
create trigger account_billing_set_timestamps
  before update on public.account_billing
  for each row
  execute function public.trigger_set_timestamps ();

alter table public.account_billing enable row level security;

revoke all on public.account_billing from authenticated, service_role;
grant select on public.account_billing to authenticated;
grant select, insert, update, delete on public.account_billing to service_role;

drop policy if exists account_billing_select on public.account_billing;
create policy account_billing_select on public.account_billing
  for select to authenticated
  using (
    public.has_role_on_account (account_id)
    or public.is_super_admin ()
  );

drop policy if exists account_billing_super_admin on public.account_billing;
create policy account_billing_super_admin on public.account_billing
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

-- ---------------------------------------------------------------------------
-- billing_events — audit trail of lifecycle transitions
-- ---------------------------------------------------------------------------
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid (),
  account_id uuid not null references public.accounts (id) on delete cascade,
  from_status public.account_billing_status,
  to_status public.account_billing_status not null,
  stripe_event_id text,
  created_at timestamptz not null default now ()
);

comment on table public.billing_events is
  'Audit log of account_billing status transitions. Dedupes webhook-driven updates via stripe_event_id; email cadence also uses billing_notification_log.';

comment on column public.billing_events.from_status is
  'Previous account_billing_status (null for first observed state).';

comment on column public.billing_events.to_status is
  'New account_billing_status after the transition.';

comment on column public.billing_events.stripe_event_id is
  'Stripe event id (evt_…) when the transition was driven by a webhook; null for cron/manual.';

create index if not exists billing_events_account_id_created_at_idx
  on public.billing_events (account_id, created_at desc);

create index if not exists billing_events_to_status_created_at_idx
  on public.billing_events (to_status, created_at desc);

create unique index if not exists billing_events_stripe_event_id_uidx
  on public.billing_events (stripe_event_id)
  where stripe_event_id is not null;

alter table public.billing_events enable row level security;

revoke all on public.billing_events from authenticated, service_role;
grant select on public.billing_events to authenticated;
grant select, insert, update, delete on public.billing_events to service_role;

-- Owners/admins with billing.manage can read the audit trail.
drop policy if exists billing_events_select on public.billing_events;
create policy billing_events_select on public.billing_events
  for select to authenticated
  using (
    public.has_permission (
      (select auth.uid ()),
      account_id,
      'billing.manage'::public.app_permissions
    )
    or public.is_super_admin ()
  );

drop policy if exists billing_events_super_admin on public.billing_events;
create policy billing_events_super_admin on public.billing_events
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

-- ---------------------------------------------------------------------------
-- Best-effort backfill from MakerKit subscriptions (platform SaaS only)
-- ---------------------------------------------------------------------------
insert into public.account_billing (
  account_id,
  subscription_status,
  trial_ends_at,
  stripe_customer_id,
  stripe_subscription_id,
  canceled_at
)
select
  s.account_id,
  case s.status::text
    when 'trialing' then 'trialing'::public.account_billing_status
    when 'active' then 'active'::public.account_billing_status
    when 'past_due' then 'past_due_grace'::public.account_billing_status
    when 'unpaid' then 'past_due_restricted'::public.account_billing_status
    when 'canceled' then 'canceled'::public.account_billing_status
    when 'incomplete_expired' then 'canceled'::public.account_billing_status
    else null
  end,
  s.trial_ends_at,
  bc.customer_id,
  s.id,
  case
    when s.status::text in ('canceled', 'incomplete_expired') then s.updated_at
    else null
  end
from public.subscriptions s
join public.billing_customers bc on bc.id = s.billing_customer_id
where s.billing_provider = 'stripe'
  and not exists (
    select 1 from public.account_billing ab where ab.account_id = s.account_id
  )
  -- Prefer the newest subscription row per account
  and s.updated_at = (
    select max (s2.updated_at)
    from public.subscriptions s2
    where s2.account_id = s.account_id
      and s2.billing_provider = 'stripe'
  )
on conflict (account_id) do nothing;
