/*
 * Referral program + content-reward credits
 */

-- Enums
create type public.referral_status as enum ('pending', 'converted', 'void');

create type public.content_submission_type as enum ('story', 'image_post', 'reel');

create type public.content_submission_status as enum (
  'pending',
  'approved',
  'rejected'
);

create type public.balance_transaction_source as enum ('referral', 'content');

create type public.reward_credit_target as enum ('personal', 'workspace');

-- user_settings extensions
alter table public.user_settings
  add column if not exists referral_code text,
  add column if not exists reward_credit_target public.reward_credit_target not null default 'personal',
  add column if not exists reward_credit_workspace_id uuid references public.accounts (id) on delete set null;

create unique index if not exists user_settings_referral_code_unique
  on public.user_settings (referral_code)
  where referral_code is not null;

create index if not exists user_settings_reward_credit_workspace_idx
  on public.user_settings (reward_credit_workspace_id)
  where reward_credit_target = 'workspace';

alter table public.user_settings
  drop constraint if exists user_settings_reward_credit_workspace_required;

alter table public.user_settings
  add constraint user_settings_reward_credit_workspace_required check (
    reward_credit_target = 'personal'
    or reward_credit_workspace_id is not null
  );

-- Referral code generator (URL-safe, 8 chars)
create or replace function kit.generate_referral_code ()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(
        chars,
        1 + floor(random() * length(chars))::int,
        1
      );
    end loop;

    if not exists (
      select 1
      from public.user_settings us
      where us.referral_code = candidate
    ) then
      return candidate;
    end if;

    attempts := attempts + 1;
    if attempts > 100 then
      raise exception 'Failed to generate unique referral code';
    end if;
  end loop;
end;
$$;

revoke all on function kit.generate_referral_code () from public;
grant execute on function kit.generate_referral_code () to service_role;

-- referral_clicks
create table if not exists public.referral_clicks (
  id uuid primary key default extensions.uuid_generate_v4 (),
  referral_code text not null,
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  utm_source text not null default 'direct',
  session_fingerprint text,
  clicked_at timestamptz not null default now(),
  converted_referred_user_id uuid references auth.users (id) on delete set null
);

create index if not exists referral_clicks_code_clicked_idx
  on public.referral_clicks (referral_code, clicked_at desc);

create index if not exists referral_clicks_referrer_clicked_idx
  on public.referral_clicks (referrer_user_id, clicked_at desc);

alter table public.referral_clicks enable row level security;

revoke all on public.referral_clicks from authenticated, service_role;

grant select, insert, update on public.referral_clicks to service_role;

-- referrals
create table if not exists public.referrals (
  id uuid primary key default extensions.uuid_generate_v4 (),
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  referred_user_id uuid not null references auth.users (id) on delete cascade,
  status public.referral_status not null default 'pending',
  utm_source text,
  referral_click_id uuid references public.referral_clicks (id) on delete set null,
  converting_account_id uuid references public.accounts (id) on delete set null,
  converting_stripe_invoice_id text,
  referrer_plan_key text,
  referrer_credit_pence int,
  referred_discount_pence int,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referrals_referred_user_unique unique (referred_user_id),
  constraint referrals_converting_invoice_unique unique (converting_stripe_invoice_id)
);

create index if not exists referrals_referrer_status_idx
  on public.referrals (referrer_user_id, status);

create index if not exists referrals_referred_idx
  on public.referrals (referred_user_id);

alter table public.referrals enable row level security;

revoke all on public.referrals from authenticated, service_role;

grant select on public.referrals to authenticated;

grant select, insert, update on public.referrals to service_role;

create policy referrals_select_own on public.referrals
  for select
  to authenticated
  using (referrer_user_id = auth.uid ());

-- content_submissions
create table if not exists public.content_submissions (
  id uuid primary key default extensions.uuid_generate_v4 (),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_type public.content_submission_type not null,
  post_url text,
  screenshot_path text,
  status public.content_submission_status not null default 'pending',
  reward_amount_pence int,
  follow_ozer_confirmed boolean,
  follower_count_at_review int,
  account_age_days_at_review int,
  reviewer_user_id uuid references auth.users (id) on delete set null,
  review_notes text,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint content_submissions_url_or_screenshot check (
    post_url is not null
    or screenshot_path is not null
  )
);

create index if not exists content_submissions_user_created_idx
  on public.content_submissions (user_id, created_at desc);

create index if not exists content_submissions_status_created_idx
  on public.content_submissions (status, created_at desc);

alter table public.content_submissions enable row level security;

revoke all on public.content_submissions from authenticated, service_role;

grant select, insert on public.content_submissions to authenticated;

grant select, insert, update on public.content_submissions to service_role;

create policy content_submissions_select_own on public.content_submissions
  for select
  to authenticated
  using (user_id = auth.uid ());

create policy content_submissions_insert_own on public.content_submissions
  for insert
  to authenticated
  with check (user_id = auth.uid ());

-- balance_transactions_log
create table if not exists public.balance_transactions_log (
  id uuid primary key default extensions.uuid_generate_v4 (),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_account_id uuid not null references public.accounts (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_balance_transaction_id text not null,
  amount_pence int not null check (amount_pence > 0),
  currency text not null default 'gbp',
  source public.balance_transaction_source not null,
  source_referral_id uuid references public.referrals (id) on delete set null,
  source_content_submission_id uuid references public.content_submissions (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint balance_transactions_log_stripe_tx_unique unique (stripe_balance_transaction_id)
);

create index if not exists balance_transactions_log_user_source_idx
  on public.balance_transactions_log (user_id, source, created_at desc);

alter table public.balance_transactions_log enable row level security;

revoke all on public.balance_transactions_log from authenticated, service_role;

grant select on public.balance_transactions_log to authenticated;

grant select, insert on public.balance_transactions_log to service_role;

create policy balance_transactions_log_select_own on public.balance_transactions_log
  for select
  to authenticated
  using (user_id = auth.uid ());

-- Content reward cap helpers (amounts in pence)
create or replace function public.content_reward_used_month_pence (
  p_user_id uuid,
  p_for_month date default date_trunc('month', now())::date
)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    sum(reward_amount_pence),
    0
  )::int
  from public.content_submissions cs
  where
    cs.user_id = p_user_id
    and cs.status in ('pending', 'approved')
    and cs.created_at >= p_for_month
    and cs.created_at < (p_for_month + interval '1 month');
$$;

create or replace function public.content_reward_used_year_pence (
  p_user_id uuid,
  p_for_year int default extract(
    year
    from
      now()
  )::int
)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    sum(reward_amount_pence),
    0
  )::int
  from public.content_submissions cs
  where
    cs.user_id = p_user_id
    and cs.status in ('pending', 'approved')
    and extract(
      year
      from
        cs.created_at
    ) = p_for_year;
$$;

create or replace function public.content_reward_would_exceed_caps (
  p_user_id uuid,
  p_new_amount_pence int,
  p_monthly_cap_pence int default 2000,
  p_annual_cap_pence int default 18000
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  month_used int;
  year_used int;
begin
  month_used := public.content_reward_used_month_pence (p_user_id);
  year_used := public.content_reward_used_year_pence (p_user_id);

  return (
    month_used + p_new_amount_pence > p_monthly_cap_pence
    or year_used + p_new_amount_pence > p_annual_cap_pence
  );
end;
$$;

grant execute on function public.content_reward_used_month_pence (uuid, date) to authenticated, service_role;

grant execute on function public.content_reward_used_year_pence (uuid, int) to authenticated, service_role;

grant execute on function public.content_reward_would_exceed_caps (uuid, int, int, int) to authenticated, service_role;

-- Storage bucket for content screenshots (private)
insert into
  storage.buckets (id, name, public)
values
  ('content-reward-screenshots', 'content-reward-screenshots', false)
on conflict (id) do nothing;

create policy content_reward_screenshots_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'content-reward-screenshots'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy content_reward_screenshots_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'content-reward-screenshots'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy content_reward_screenshots_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'content-reward-screenshots'
    and (storage.foldername (name))[1] = auth.uid ()::text
  )
  with check (
    bucket_id = 'content-reward-screenshots'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy content_reward_screenshots_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'content-reward-screenshots'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

-- Ensure user_settings row + referral code on signup
create or replace function kit.ensure_user_settings_with_referral (p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id, referral_code)
  values (p_user_id, kit.generate_referral_code ())
  on conflict (user_id) do update
  set
    referral_code = coalesce(
      public.user_settings.referral_code,
      kit.generate_referral_code ()
    )
  where public.user_settings.referral_code is null;
end;
$$;

revoke all on function kit.ensure_user_settings_with_referral (uuid) from public;

grant execute on function kit.ensure_user_settings_with_referral (uuid) to service_role;
