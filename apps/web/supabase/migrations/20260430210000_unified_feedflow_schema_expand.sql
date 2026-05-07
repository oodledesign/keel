-- Expand feedflow tables + integrations for migrated Feedflow logic (widgets embed, Google, Webflow, cron).

-- ---------- widgets (embed UI) ----------
alter table feedflow.widgets add column if not exists layout text default 'grid';
alter table feedflow.widgets add column if not exists post_count integer default 9;
alter table feedflow.widgets add column if not exists show_captions boolean default false;
alter table feedflow.widgets add column if not exists show_likes boolean default false;
alter table feedflow.widgets add column if not exists open_in text default 'instagram';
alter table feedflow.widgets add column if not exists gap integer default 8;
alter table feedflow.widgets add column if not exists border_radius integer default 0;
alter table feedflow.widgets add column if not exists columns_desktop integer default 3;
alter table feedflow.widgets add column if not exists columns_tablet integer default 2;
alter table feedflow.widgets add column if not exists columns_mobile integer default 1;
alter table feedflow.widgets add column if not exists slider_autoplay boolean default false;
alter table feedflow.widgets add column if not exists slider_autoplay_speed integer default 3000;
alter table feedflow.widgets add column if not exists accent_colour text default '#000000';
alter table feedflow.widgets add column if not exists custom_css text;

-- ---------- social_accounts ----------
alter table feedflow.social_accounts add column if not exists platform text;
alter table feedflow.social_accounts add column if not exists platform_user_id text;
alter table feedflow.social_accounts add column if not exists last_refreshed_at timestamptz;
alter table feedflow.social_accounts add column if not exists token_status text default 'active';
alter table feedflow.social_accounts add column if not exists connected_at timestamptz default now();

update feedflow.social_accounts set platform = provider where platform is null;

-- ---------- feed_cache (dual payload/raw_json for ported jobs) ----------
alter table feedflow.feed_cache add column if not exists raw_json jsonb;
alter table feedflow.feed_cache add column if not exists expires_at timestamptz;
alter table feedflow.feed_cache add column if not exists cached_at timestamptz default now();

update feedflow.feed_cache set raw_json = payload where raw_json is null and payload is not null;

-- ---------- token_refresh_log ----------
create table if not exists feedflow.token_refresh_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  social_account_id uuid references feedflow.social_accounts (id) on delete cascade,
  platform text,
  success boolean,
  error_message text,
  attempted_at timestamptz default now()
);

alter table feedflow.token_refresh_log enable row level security;

drop policy if exists feedflow_token_refresh_log_rw on feedflow.token_refresh_log;
create policy feedflow_token_refresh_log_rw on feedflow.token_refresh_log for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

-- ---------- google_accounts + reviews cache ----------
create table if not exists feedflow.google_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  google_account_id text,
  location_id text,
  location_name text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  last_refreshed_at timestamptz,
  token_status text default 'active',
  connected_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists feedflow.google_reviews_cache (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  google_account_id uuid not null references feedflow.google_accounts (id) on delete cascade,
  raw_json jsonb not null,
  average_rating numeric(2, 1),
  total_review_count integer,
  excluded_review_ids text[] default '{}',
  cached_at timestamptz default now(),
  expires_at timestamptz default now()
);

create unique index if not exists google_reviews_cache_one_per_account_feedflow
  on feedflow.google_reviews_cache (google_account_id);

alter table feedflow.google_accounts enable row level security;
alter table feedflow.google_reviews_cache enable row level security;

drop policy if exists feedflow_google_accounts_rw on feedflow.google_accounts;
create policy feedflow_google_accounts_rw on feedflow.google_accounts for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists feedflow_google_reviews_cache_rw on feedflow.google_reviews_cache;
create policy feedflow_google_reviews_cache_rw on feedflow.google_reviews_cache for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

-- ---------- webflow ----------
create table if not exists feedflow.webflow_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  google_account_id uuid references feedflow.google_accounts (id) on delete set null,
  webflow_site_id text not null,
  webflow_collection_id text not null,
  webflow_api_token text not null,
  sync_mode text default 'all',
  auto_publish boolean default false,
  min_character_count integer default 0,
  last_synced_at timestamptz,
  sync_status text default 'idle',
  sync_error text,
  created_at timestamptz default now()
);

create table if not exists feedflow.webflow_sync_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  webflow_connection_id uuid references feedflow.webflow_connections (id) on delete cascade,
  reviews_fetched integer,
  reviews_synced integer,
  reviews_skipped integer,
  success boolean,
  error_message text,
  synced_at timestamptz default now()
);

alter table feedflow.webflow_connections enable row level security;
alter table feedflow.webflow_sync_log enable row level security;

drop policy if exists feedflow_webflow_connections_rw on feedflow.webflow_connections;
create policy feedflow_webflow_connections_rw on feedflow.webflow_connections for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists feedflow_webflow_sync_log_rw on feedflow.webflow_sync_log;
create policy feedflow_webflow_sync_log_rw on feedflow.webflow_sync_log for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

-- ---------- bunny_libraries ----------
create table if not exists feedflow.bunny_libraries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  library_id text not null,
  created_at timestamptz not null default now()
);

alter table feedflow.bunny_libraries enable row level security;

drop policy if exists feedflow_bunny_libraries_rw on feedflow.bunny_libraries;
create policy feedflow_bunny_libraries_rw on feedflow.bunny_libraries for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

-- ---------- grants ----------
grant usage on schema feedflow to authenticated, service_role;
grant all on all tables in schema feedflow to postgres, service_role;
grant select, insert, update, delete on all tables in schema feedflow to authenticated;
