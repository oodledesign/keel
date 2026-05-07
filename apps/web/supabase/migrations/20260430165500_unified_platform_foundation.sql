-- Unified platform foundation for keel + feedflow + rankly

create schema if not exists feedflow;
create schema if not exists rankly;

-- Shared profile table used by imported modules.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.trigger_set_timestamps();

create or replace function public.handle_platform_profile_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_platform_auth_user_created on auth.users;
create trigger on_platform_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_platform_profile_create();

create or replace function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts_memberships m
    where m.account_id = target_account_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_account_admin(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts_memberships m
    where m.account_id = target_account_id
      and m.user_id = auth.uid()
      and m.account_role in ('owner', 'admin')
  );
$$;

-- Feedflow domain tables
create table if not exists feedflow.social_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  provider text not null,
  external_account_id text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider, external_account_id)
);

create table if not exists feedflow.widgets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  social_account_id uuid references feedflow.social_accounts (id) on delete set null,
  name text not null,
  embed_key text unique not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists feedflow.feed_cache (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  social_account_id uuid references feedflow.social_accounts (id) on delete cascade,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists feedflow.videos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  bunny_video_id text,
  embed_key text unique,
  title text,
  status text not null default 'processing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rankly domain tables
create table if not exists rankly.projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  domain text not null,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rankly.keywords (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  keyword text not null,
  search_engine text not null default 'google',
  device text not null default 'desktop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rankly.keyword_rankings (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references rankly.keywords (id) on delete cascade,
  rank_date date not null,
  position integer,
  url text,
  created_at timestamptz not null default now(),
  unique (keyword_id, rank_date)
);

create table if not exists rankly.backlinks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  source_url text not null,
  target_url text,
  source_domain text,
  discovered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists rankly.alerts (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references rankly.keywords (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  alert_type text not null,
  threshold numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Timestamp triggers for new mutable tables
drop trigger if exists feedflow_social_accounts_set_timestamps on feedflow.social_accounts;
create trigger feedflow_social_accounts_set_timestamps
before update on feedflow.social_accounts
for each row
execute procedure public.trigger_set_timestamps();

drop trigger if exists feedflow_widgets_set_timestamps on feedflow.widgets;
create trigger feedflow_widgets_set_timestamps
before update on feedflow.widgets
for each row
execute procedure public.trigger_set_timestamps();

drop trigger if exists feedflow_videos_set_timestamps on feedflow.videos;
create trigger feedflow_videos_set_timestamps
before update on feedflow.videos
for each row
execute procedure public.trigger_set_timestamps();

drop trigger if exists rankly_projects_set_timestamps on rankly.projects;
create trigger rankly_projects_set_timestamps
before update on rankly.projects
for each row
execute procedure public.trigger_set_timestamps();

drop trigger if exists rankly_keywords_set_timestamps on rankly.keywords;
create trigger rankly_keywords_set_timestamps
before update on rankly.keywords
for each row
execute procedure public.trigger_set_timestamps();

drop trigger if exists rankly_alerts_set_timestamps on rankly.alerts;
create trigger rankly_alerts_set_timestamps
before update on rankly.alerts
for each row
execute procedure public.trigger_set_timestamps();

-- RLS defaults
alter table feedflow.social_accounts enable row level security;
alter table feedflow.widgets enable row level security;
alter table feedflow.feed_cache enable row level security;
alter table feedflow.videos enable row level security;
alter table rankly.projects enable row level security;
alter table rankly.keywords enable row level security;
alter table rankly.keyword_rankings enable row level security;
alter table rankly.backlinks enable row level security;
alter table rankly.alerts enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists feedflow_social_accounts_rw on feedflow.social_accounts;
create policy feedflow_social_accounts_rw
on feedflow.social_accounts for all
to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists feedflow_widgets_rw on feedflow.widgets;
create policy feedflow_widgets_rw
on feedflow.widgets for all
to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists feedflow_feed_cache_rw on feedflow.feed_cache;
create policy feedflow_feed_cache_rw
on feedflow.feed_cache for all
to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists feedflow_videos_rw on feedflow.videos;
create policy feedflow_videos_rw
on feedflow.videos for all
to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists rankly_projects_rw on rankly.projects;
create policy rankly_projects_rw
on rankly.projects for all
to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists rankly_keywords_rw on rankly.keywords;
create policy rankly_keywords_rw
on rankly.keywords for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.keywords.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.keywords.project_id
      and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_keyword_rankings_rw on rankly.keyword_rankings;
create policy rankly_keyword_rankings_rw
on rankly.keyword_rankings for all
to authenticated
using (
  exists (
    select 1
    from rankly.keywords k
    join rankly.projects p on p.id = k.project_id
    where k.id = rankly.keyword_rankings.keyword_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1
    from rankly.keywords k
    join rankly.projects p on p.id = k.project_id
    where k.id = rankly.keyword_rankings.keyword_id
      and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_backlinks_rw on rankly.backlinks;
create policy rankly_backlinks_rw
on rankly.backlinks for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.backlinks.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.backlinks.project_id
      and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_alerts_rw on rankly.alerts;
create policy rankly_alerts_rw
on rankly.alerts for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
