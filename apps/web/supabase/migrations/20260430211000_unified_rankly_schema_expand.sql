create extension if not exists "pgcrypto";

-- ============ extend rankly.projects ============
alter table rankly.projects add column if not exists colour text;
alter table rankly.projects add column if not exists notes text;
alter table rankly.projects add column if not exists target_country text not null default 'US';
alter table rankly.projects add column if not exists target_language text not null default 'en';
alter table rankly.projects add column if not exists track_desktop boolean not null default true;
alter table rankly.projects add column if not exists track_mobile boolean not null default true;

-- ============ extend rankly.keywords ============
alter table rankly.keywords add column if not exists keyword_normalized text
  generated always as (lower(trim(keyword))) stored;
alter table rankly.keywords add column if not exists search_volume integer;
alter table rankly.keywords add column if not exists keyword_difficulty numeric;
alter table rankly.keywords add column if not exists cpc numeric;

-- ============ keyword_rankings: align with legacy rankly API (date + device + extras) ============
alter table rankly.keyword_rankings add column if not exists device text not null default 'desktop';
alter table rankly.keyword_rankings add column if not exists serp_features jsonb not null default '[]'::jsonb;
alter table rankly.keyword_rankings add column if not exists ai_overview_present boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'rankly' and table_name = 'keyword_rankings' and column_name = 'rank_date'
  ) then
    alter table rankly.keyword_rankings rename column rank_date to "date";
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'rankly' and table_name = 'keyword_rankings' and column_name = 'url'
  ) then
    alter table rankly.keyword_rankings rename column url to ranking_url;
  end if;
end $$;

alter table rankly.keyword_rankings drop constraint if exists keyword_rankings_keyword_id_rank_date_key;
alter table rankly.keyword_rankings add constraint rankly_keyword_rankings_kw_date_device_unique
  unique (keyword_id, "date", device);

-- ============ extend rankly.backlinks ============
alter table rankly.backlinks add column if not exists crawl_id uuid;
alter table rankly.backlinks add column if not exists source_domain text;
alter table rankly.backlinks add column if not exists source_dr numeric;
alter table rankly.backlinks add column if not exists anchor_text text;
alter table rankly.backlinks add column if not exists link_type text not null default 'dofollow';
alter table rankly.backlinks add column if not exists first_seen date;
alter table rankly.backlinks add column if not exists last_seen date;
alter table rankly.backlinks add column if not exists status text not null default 'active';
alter table rankly.backlinks add column if not exists crawled_at timestamptz not null default now();

-- ============ extend rankly.alerts ============
alter table rankly.alerts add column if not exists threshold_position integer;
alter table rankly.alerts add column if not exists last_triggered_at timestamptz;

update rankly.alerts set threshold_position = floor(coalesce(threshold, 0))::integer where threshold_position is null;

-- ============ project_competitors ============
create table if not exists rankly.project_competitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  competitor_domain text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists rankly_project_competitors_project_domain_lower_unique
  on rankly.project_competitors (project_id, lower(competitor_domain));

create or replace function rankly.enforce_max_project_competitors()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cnt integer;
begin
  select count(*)::integer into cnt
  from rankly.project_competitors
  where project_id = new.project_id;

  if cnt >= 5 then
    raise exception 'Maximum 5 competitors per project';
  end if;
  return new;
end;
$$;

drop trigger if exists rankly_project_competitors_max_five on rankly.project_competitors;
create trigger rankly_project_competitors_max_five
before insert on rankly.project_competitors
for each row
execute function rankly.enforce_max_project_competitors();

-- ============ tags ============
create table if not exists rankly.tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists rankly_tags_project_name_lower_unique
  on rankly.tags (project_id, lower(name));

create table if not exists rankly.keyword_tag_assignments (
  keyword_id uuid not null references rankly.keywords (id) on delete cascade,
  tag_id uuid not null references rankly.tags (id) on delete cascade,
  primary key (keyword_id, tag_id)
);

-- ============ domain_metrics ============
create table if not exists rankly.domain_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  domain text not null,
  is_competitor boolean not null default false,
  da_score numeric,
  dr_score numeric,
  backlinks_total bigint,
  referring_domains bigint,
  dofollow_count bigint,
  nofollow_count bigint,
  organic_traffic_estimate bigint,
  source_endpoint text,
  recorded_at date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists rankly_domain_metrics_project_domain_snapshot_unique
  on rankly.domain_metrics (project_id, lower(domain), is_competitor, recorded_at);

-- ============ backlink crawls ============
create table if not exists rankly.backlink_crawls (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table rankly.backlinks
  drop constraint if exists backlinks_crawl_id_fkey;

alter table rankly.backlinks
  add constraint backlinks_crawl_id_fkey
  foreign key (crawl_id) references rankly.backlink_crawls (id) on delete set null;

-- ============ competitor_keywords ============
create table if not exists rankly.competitor_keywords (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  competitor_domain text not null,
  keyword_id uuid not null references rankly.keywords (id) on delete cascade,
  competitor_position integer,
  recorded_at date not null,
  unique (project_id, competitor_domain, keyword_id, recorded_at)
);

-- ============ keyword_research_cache ============
create table if not exists rankly.keyword_research_cache (
  id uuid primary key default gen_random_uuid(),
  seed_keyword text not null,
  country text not null,
  language text not null,
  results jsonb not null,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index if not exists rankly_keyword_research_seed_country_lang_unique
  on rankly.keyword_research_cache (lower(trim(seed_keyword)), country, language);

-- ============ alert_history ============
create table if not exists rankly.alert_history (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references rankly.alerts (id) on delete cascade,
  triggered_at timestamptz not null default now(),
  previous_position integer,
  new_position integer,
  notified boolean not null default false
);

-- ============ dataforseo_api_log ============
create table if not exists rankly.dataforseo_api_log (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  project_id uuid references rankly.projects (id) on delete set null,
  task_count integer not null default 1,
  estimated_cost_usd numeric,
  feature_area text,
  called_at timestamptz not null default now()
);

-- ============ project_cron_state ============
create table if not exists rankly.project_cron_state (
  project_id uuid primary key references rankly.projects (id) on delete cascade,
  last_rank_check_at date,
  last_backlink_refresh_at timestamptz,
  last_domain_metrics_at timestamptz,
  last_competitor_labs_at timestamptz
);

-- ============ RLS for new / expanded tables ============
alter table rankly.project_competitors enable row level security;
alter table rankly.tags enable row level security;
alter table rankly.keyword_tag_assignments enable row level security;
alter table rankly.domain_metrics enable row level security;
alter table rankly.backlink_crawls enable row level security;
alter table rankly.competitor_keywords enable row level security;
alter table rankly.keyword_research_cache enable row level security;
alter table rankly.alert_history enable row level security;
alter table rankly.dataforseo_api_log enable row level security;
alter table rankly.project_cron_state enable row level security;

-- Helper expression: membership via project
drop policy if exists rankly_project_competitors_rw on rankly.project_competitors;
create policy rankly_project_competitors_rw on rankly.project_competitors for all to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.project_competitors.project_id and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.project_competitors.project_id and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_tags_rw on rankly.tags;
create policy rankly_tags_rw on rankly.tags for all to authenticated
using (
  exists (select 1 from rankly.projects p where p.id = rankly.tags.project_id and public.is_account_member(p.account_id))
)
with check (
  exists (select 1 from rankly.projects p where p.id = rankly.tags.project_id and public.is_account_member(p.account_id))
);

drop policy if exists rankly_keyword_tag_assignments_rw on rankly.keyword_tag_assignments;
create policy rankly_keyword_tag_assignments_rw on rankly.keyword_tag_assignments for all to authenticated
using (
  exists (
    select 1 from rankly.keywords k
    join rankly.projects p on p.id = k.project_id
    where k.id = rankly.keyword_tag_assignments.keyword_id and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.keywords k
    join rankly.projects p on p.id = k.project_id
    where k.id = rankly.keyword_tag_assignments.keyword_id and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_domain_metrics_rw on rankly.domain_metrics;
create policy rankly_domain_metrics_rw on rankly.domain_metrics for all to authenticated
using (
  exists (select 1 from rankly.projects p where p.id = rankly.domain_metrics.project_id and public.is_account_member(p.account_id))
)
with check (
  exists (select 1 from rankly.projects p where p.id = rankly.domain_metrics.project_id and public.is_account_member(p.account_id))
);

drop policy if exists rankly_backlink_crawls_rw on rankly.backlink_crawls;
create policy rankly_backlink_crawls_rw on rankly.backlink_crawls for all to authenticated
using (
  exists (select 1 from rankly.projects p where p.id = rankly.backlink_crawls.project_id and public.is_account_member(p.account_id))
)
with check (
  exists (select 1 from rankly.projects p where p.id = rankly.backlink_crawls.project_id and public.is_account_member(p.account_id))
);

drop policy if exists rankly_competitor_keywords_rw on rankly.competitor_keywords;
create policy rankly_competitor_keywords_rw on rankly.competitor_keywords for all to authenticated
using (
  exists (select 1 from rankly.projects p where p.id = rankly.competitor_keywords.project_id and public.is_account_member(p.account_id))
)
with check (
  exists (select 1 from rankly.projects p where p.id = rankly.competitor_keywords.project_id and public.is_account_member(p.account_id))
);

drop policy if exists rankly_keyword_research_cache_select on rankly.keyword_research_cache;
create policy rankly_keyword_research_cache_select on rankly.keyword_research_cache for select to authenticated using (true);

drop policy if exists rankly_alert_history_rw on rankly.alert_history;
create policy rankly_alert_history_rw on rankly.alert_history for all to authenticated
using (
  exists (
    select 1 from rankly.alerts a
    where a.id = rankly.alert_history.alert_id and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from rankly.alerts a
    where a.id = rankly.alert_history.alert_id and a.user_id = auth.uid()
  )
);

drop policy if exists rankly_dataforseo_api_log_deny on rankly.dataforseo_api_log;
create policy rankly_dataforseo_api_log_deny on rankly.dataforseo_api_log for select to authenticated using (false);

drop policy if exists rankly_project_cron_state_rw on rankly.project_cron_state;
create policy rankly_project_cron_state_rw on rankly.project_cron_state for all to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.project_cron_state.project_id and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.project_cron_state.project_id and public.is_account_member(p.account_id)
  )
);

-- Replace keyword_rankings / alerts policies to match new columns (drop old names if any)
drop policy if exists rankly_keyword_rankings_rw on rankly.keyword_rankings;
create policy rankly_keyword_rankings_rw on rankly.keyword_rankings for all to authenticated
using (
  exists (
    select 1 from rankly.keywords k
    join rankly.projects p on p.id = k.project_id
    where k.id = rankly.keyword_rankings.keyword_id and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.keywords k
    join rankly.projects p on p.id = k.project_id
    where k.id = rankly.keyword_rankings.keyword_id and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_alerts_rw on rankly.alerts;
create policy rankly_alerts_rw on rankly.alerts for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Grants
grant usage on schema rankly to authenticated, service_role;
grant all on all tables in schema rankly to postgres, service_role;
grant select, insert, update, delete on all tables in schema rankly to authenticated;
