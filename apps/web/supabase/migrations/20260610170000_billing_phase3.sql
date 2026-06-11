-- Billing notification dedupe log + backfill add-on modules from entitlements.

create table if not exists public.billing_notification_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  subscription_id text not null,
  notification_type text not null
    check (
      notification_type in (
        'trial_ending_3d',
        'trial_ending_1d',
        'trial_ended',
        'payment_failed'
      )
    ),
  sent_at timestamptz not null default now(),
  unique (subscription_id, notification_type)
);

create index if not exists billing_notification_log_account_id_idx
  on public.billing_notification_log (account_id);

alter table public.billing_notification_log enable row level security;

create policy billing_notification_log_super_admin on public.billing_notification_log
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

grant all on public.billing_notification_log to service_role;

-- Backfill: enable add-on modules where entitlements already exist.
insert into public.account_module_settings (account_id, module_key, enabled)
select account_id, 'rankly', true
from public.account_entitlements
where entitlement_key = 'addon_rankly'
  and (expires_at is null or expires_at > now())
on conflict (account_id, module_key) do update set enabled = true;

insert into public.account_module_settings (account_id, module_key, enabled)
select account_id, 'feedflow', true
from public.account_entitlements
where entitlement_key = 'addon_feedflow'
  and (expires_at is null or expires_at > now())
on conflict (account_id, module_key) do update set enabled = true;

insert into public.account_module_settings (account_id, module_key, enabled)
select account_id, 'videos', true
from public.account_entitlements
where entitlement_key = 'addon_videos'
  and (expires_at is null or expires_at > now())
on conflict (account_id, module_key) do update set enabled = true;

insert into public.account_module_settings (account_id, module_key, enabled)
select distinct account_id, 'apps', true
from public.account_entitlements
where entitlement_key in ('addon_rankly', 'addon_feedflow', 'addon_videos')
  and (expires_at is null or expires_at > now())
on conflict (account_id, module_key) do update set enabled = true;
