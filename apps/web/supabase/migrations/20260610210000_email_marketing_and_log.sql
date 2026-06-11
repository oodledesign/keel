-- Super admin email marketing + platform email audit log.

create table if not exists public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  trade text,
  source text default 'manual' check (source in ('manual', 'interest_form', 'imported', 'beta')),
  notes text,
  subscribed boolean default true
);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  subject text not null,
  preview_text text,
  html_body text not null,
  plain_text_body text,
  template_id text,
  status text not null default 'draft' check (
    status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')
  ),
  recipient_list text not null check (
    recipient_list in (
      'all_users',
      'tier_1',
      'tier_2',
      'tier_3',
      'business_owners',
      'inactive',
      'beta_users',
      'no_subscription',
      'pre_signup_contacts',
      'beta_contacts',
      'contact_list',
      'manual',
      'custom'
    )
  ),
  contact_list_id uuid,
  custom_recipient_ids uuid[],
  manual_recipient_emails text[],
  total_recipients int default 0,
  sent_count int default 0,
  scheduled_at timestamptz,
  sent_at timestamptz
);

create table if not exists public.email_campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.email_contacts(id) on delete set null,
  email text not null,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  open_count int default 0,
  click_count int default 0,
  bounced boolean default false,
  unsubscribed boolean default false
);

create table if not exists public.email_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.email_contacts(id) on delete set null,
  unsubscribed_at timestamptz default now(),
  reason text
);

create table if not exists public.email_contact_lists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  description text
);

create table if not exists public.email_contact_list_members (
  list_id uuid not null references public.email_contact_lists(id) on delete cascade,
  contact_id uuid not null references public.email_contacts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (list_id, contact_id)
);

create table if not exists public.email_contact_list_exclusions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.email_contacts(id) on delete cascade,
  list_key text not null check (
    list_key in ('pre_signup_contacts', 'beta_contacts')
  ),
  created_at timestamptz default now(),
  unique (contact_id, list_key)
);

alter table public.email_campaigns
  drop constraint if exists email_campaigns_contact_list_id_fkey;

alter table public.email_campaigns
  add constraint email_campaigns_contact_list_id_fkey
  foreign key (contact_list_id)
  references public.email_contact_lists(id)
  on delete set null;

create index if not exists ix_email_contacts_email
  on public.email_contacts (lower(email));

create index if not exists ix_email_contacts_source
  on public.email_contacts (source);

create index if not exists ix_email_contacts_trade
  on public.email_contacts (trade)
  where trade is not null;

create index if not exists ix_email_campaigns_created_at
  on public.email_campaigns (created_at desc);

create index if not exists ix_email_campaigns_status
  on public.email_campaigns (status);

create index if not exists ix_email_campaign_metrics_campaign
  on public.email_campaign_metrics (campaign_id);

create index if not exists ix_email_campaign_metrics_email
  on public.email_campaign_metrics (lower(email));

create unique index if not exists ux_email_campaign_metrics_campaign_email
  on public.email_campaign_metrics (campaign_id, email);

create index if not exists ix_email_unsubscribes_email
  on public.email_unsubscribes (lower(email));

create index if not exists ix_email_contact_list_members_contact
  on public.email_contact_list_members (contact_id);

create index if not exists ix_email_contact_list_exclusions_list_key
  on public.email_contact_list_exclusions (list_key);

drop trigger if exists email_contacts_set_timestamps on public.email_contacts;
create trigger email_contacts_set_timestamps
  before insert or update on public.email_contacts
  for each row execute function public.trigger_set_timestamps();

drop trigger if exists email_campaigns_set_timestamps on public.email_campaigns;
create trigger email_campaigns_set_timestamps
  before insert or update on public.email_campaigns
  for each row execute function public.trigger_set_timestamps();

drop trigger if exists email_contact_lists_set_timestamps on public.email_contact_lists;
create trigger email_contact_lists_set_timestamps
  before insert or update on public.email_contact_lists
  for each row execute function public.trigger_set_timestamps();

alter table public.email_contacts enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_metrics enable row level security;
alter table public.email_unsubscribes enable row level security;
alter table public.email_contact_lists enable row level security;
alter table public.email_contact_list_members enable row level security;
alter table public.email_contact_list_exclusions enable row level security;

grant select, insert, update, delete on public.email_contacts to authenticated, service_role;
grant select, insert, update, delete on public.email_campaigns to authenticated, service_role;
grant select, insert, update, delete on public.email_campaign_metrics to authenticated, service_role;
grant select, insert, update, delete on public.email_unsubscribes to authenticated, service_role;
grant insert on public.email_unsubscribes to anon;
grant select, insert, update, delete on public.email_contact_lists to authenticated, service_role;
grant select, insert, update, delete on public.email_contact_list_members to authenticated, service_role;
grant select, insert, update, delete on public.email_contact_list_exclusions to authenticated, service_role;

drop policy if exists email_contacts_super_admin_select on public.email_contacts;
create policy email_contacts_super_admin_select
  on public.email_contacts for select to authenticated
  using (public.is_super_admin());

drop policy if exists email_contacts_super_admin_insert on public.email_contacts;
create policy email_contacts_super_admin_insert
  on public.email_contacts for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists email_contacts_super_admin_update on public.email_contacts;
create policy email_contacts_super_admin_update
  on public.email_contacts for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists email_contacts_super_admin_delete on public.email_contacts;
create policy email_contacts_super_admin_delete
  on public.email_contacts for delete to authenticated
  using (public.is_super_admin());

drop policy if exists email_campaigns_super_admin_select on public.email_campaigns;
create policy email_campaigns_super_admin_select
  on public.email_campaigns for select to authenticated
  using (public.is_super_admin());

drop policy if exists email_campaigns_super_admin_insert on public.email_campaigns;
create policy email_campaigns_super_admin_insert
  on public.email_campaigns for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists email_campaigns_super_admin_update on public.email_campaigns;
create policy email_campaigns_super_admin_update
  on public.email_campaigns for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists email_campaigns_super_admin_delete on public.email_campaigns;
create policy email_campaigns_super_admin_delete
  on public.email_campaigns for delete to authenticated
  using (public.is_super_admin());

drop policy if exists email_campaign_metrics_super_admin_select on public.email_campaign_metrics;
create policy email_campaign_metrics_super_admin_select
  on public.email_campaign_metrics for select to authenticated
  using (public.is_super_admin());

drop policy if exists email_campaign_metrics_super_admin_insert on public.email_campaign_metrics;
create policy email_campaign_metrics_super_admin_insert
  on public.email_campaign_metrics for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists email_campaign_metrics_super_admin_update on public.email_campaign_metrics;
create policy email_campaign_metrics_super_admin_update
  on public.email_campaign_metrics for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists email_campaign_metrics_super_admin_delete on public.email_campaign_metrics;
create policy email_campaign_metrics_super_admin_delete
  on public.email_campaign_metrics for delete to authenticated
  using (public.is_super_admin());

drop policy if exists email_unsubscribes_super_admin_select on public.email_unsubscribes;
create policy email_unsubscribes_super_admin_select
  on public.email_unsubscribes for select to authenticated
  using (public.is_super_admin());

drop policy if exists email_unsubscribes_super_admin_insert on public.email_unsubscribes;
create policy email_unsubscribes_super_admin_insert
  on public.email_unsubscribes for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists email_unsubscribes_public_insert on public.email_unsubscribes;
create policy email_unsubscribes_public_insert
  on public.email_unsubscribes for insert to anon
  with check (email is not null and length(trim(email)) > 3);

drop policy if exists email_unsubscribes_super_admin_update on public.email_unsubscribes;
create policy email_unsubscribes_super_admin_update
  on public.email_unsubscribes for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists email_unsubscribes_super_admin_delete on public.email_unsubscribes;
create policy email_unsubscribes_super_admin_delete
  on public.email_unsubscribes for delete to authenticated
  using (public.is_super_admin());

drop policy if exists email_contact_lists_super_admin_all on public.email_contact_lists;
create policy email_contact_lists_super_admin_all
  on public.email_contact_lists for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists email_contact_list_members_super_admin_all on public.email_contact_list_members;
create policy email_contact_list_members_super_admin_all
  on public.email_contact_list_members for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists email_contact_list_exclusions_super_admin_all on public.email_contact_list_exclusions;
create policy email_contact_list_exclusions_super_admin_all
  on public.email_contact_list_exclusions for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Platform email audit log (super admin read-only).

create table if not exists public.platform_email_log (
  id uuid primary key default gen_random_uuid(),
  email_type text not null,
  account_id uuid references public.accounts (id) on delete set null,
  recipient_email text not null,
  sender_email text,
  subject text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.platform_email_log is 'Audit log of outbound platform emails for super admin review';

create index if not exists ix_platform_email_log_created_at
  on public.platform_email_log (created_at desc);

create index if not exists ix_platform_email_log_email_type
  on public.platform_email_log (email_type);

create index if not exists ix_platform_email_log_account_id
  on public.platform_email_log (account_id)
  where account_id is not null;

alter table public.platform_email_log enable row level security;

revoke all on public.platform_email_log from authenticated, service_role;
grant select on public.platform_email_log to authenticated, service_role;
grant insert on public.platform_email_log to service_role;

drop policy if exists super_admins_read_platform_email_log on public.platform_email_log;
create policy super_admins_read_platform_email_log
  on public.platform_email_log
  as permissive for select to authenticated
  using (public.is_super_admin());

drop policy if exists account_members_read_platform_email_log on public.platform_email_log;
create policy account_members_read_platform_email_log
  on public.platform_email_log
  as permissive for select to authenticated
  using (
    account_id is not null
    and public.has_role_on_account(account_id)
  );
