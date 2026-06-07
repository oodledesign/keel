-- PageSpeed Insights tracking per Rankly project

alter table rankly.projects
  add column if not exists pagespeed_refresh_interval text not null default 'weekly';

alter table rankly.projects
  drop constraint if exists rankly_projects_pagespeed_refresh_interval_check;

alter table rankly.projects
  add constraint rankly_projects_pagespeed_refresh_interval_check
  check (pagespeed_refresh_interval in ('manual', 'daily', 'weekly', 'monthly'));

comment on column rankly.projects.pagespeed_refresh_interval is
  'How often Rankly refreshes PageSpeed Insights for tracked URLs.';

alter table rankly.project_cron_state
  add column if not exists last_pagespeed_check_at timestamptz;

alter table rankly.project_cron_state
  add column if not exists next_pagespeed_check_at timestamptz;

create table if not exists rankly.pagespeed_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  url text not null,
  url_normalized text generated always as (lower(trim(url))) stored,
  label text,
  is_homepage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pagespeed_pages_url_unique unique (project_id, url_normalized)
);

create index if not exists ix_pagespeed_pages_project_id
  on rankly.pagespeed_pages (project_id);

drop trigger if exists rankly_pagespeed_pages_set_timestamps on rankly.pagespeed_pages;
create trigger rankly_pagespeed_pages_set_timestamps
before update on rankly.pagespeed_pages
for each row execute function public.trigger_set_timestamps();

create table if not exists rankly.pagespeed_results (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references rankly.pagespeed_pages (id) on delete cascade,
  strategy text not null,
  performance_score smallint,
  accessibility_score smallint,
  best_practices_score smallint,
  seo_score smallint,
  lcp_ms numeric,
  fcp_ms numeric,
  cls numeric,
  tbt_ms numeric,
  speed_index_ms numeric,
  error_msg text,
  fetched_at timestamptz not null default now(),
  constraint pagespeed_results_strategy_check check (
    strategy in ('mobile', 'desktop')
  )
);

create index if not exists ix_pagespeed_results_page_id
  on rankly.pagespeed_results (page_id, fetched_at desc);

create table if not exists rankly.pagespeed_check_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending',
  trigger_source text not null default 'manual',
  tasks_completed integer not null default 0,
  tasks_total integer not null default 0,
  error_msg text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pagespeed_check_jobs_status_check check (
    status in ('pending', 'running', 'done', 'error')
  ),
  constraint pagespeed_check_jobs_trigger_source_check check (
    trigger_source in ('manual', 'cron')
  )
);

create index if not exists ix_pagespeed_check_jobs_project_id
  on rankly.pagespeed_check_jobs (project_id);

drop trigger if exists rankly_pagespeed_check_jobs_set_timestamps on rankly.pagespeed_check_jobs;
create trigger rankly_pagespeed_check_jobs_set_timestamps
before update on rankly.pagespeed_check_jobs
for each row execute function public.trigger_set_timestamps();

alter table rankly.pagespeed_pages enable row level security;
alter table rankly.pagespeed_results enable row level security;
alter table rankly.pagespeed_check_jobs enable row level security;

drop policy if exists rankly_pagespeed_pages_rw on rankly.pagespeed_pages;
create policy rankly_pagespeed_pages_rw on rankly.pagespeed_pages
for all to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.pagespeed_pages.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.pagespeed_pages.project_id
      and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_pagespeed_results_rw on rankly.pagespeed_results;
create policy rankly_pagespeed_results_rw on rankly.pagespeed_results
for all to authenticated
using (
  exists (
    select 1 from rankly.pagespeed_pages pg
    join rankly.projects p on p.id = pg.project_id
    where pg.id = rankly.pagespeed_results.page_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.pagespeed_pages pg
    join rankly.projects p on p.id = pg.project_id
    where pg.id = rankly.pagespeed_results.page_id
      and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_pagespeed_check_jobs_rw on rankly.pagespeed_check_jobs;
create policy rankly_pagespeed_check_jobs_rw on rankly.pagespeed_check_jobs
for all to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.pagespeed_check_jobs.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.pagespeed_check_jobs.project_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.pagespeed_pages to authenticated;
grant select, insert, update, delete on rankly.pagespeed_results to authenticated;
grant select, insert, update, delete on rankly.pagespeed_check_jobs to authenticated;
grant all on rankly.pagespeed_pages, rankly.pagespeed_results, rankly.pagespeed_check_jobs
  to postgres, service_role;

-- Seed homepage URLs for existing projects
insert into rankly.pagespeed_pages (project_id, url, label, is_homepage)
select
  p.id,
  case
    when p.domain ~* '^https?://' then trim(trailing '/' from p.domain)
    else 'https://' || trim(both '/' from p.domain)
  end,
  'Homepage',
  true
from rankly.projects p
where p.domain is not null
  and trim(p.domain) <> ''
on conflict (project_id, url_normalized) do nothing;

-- Schedule first PageSpeed check for projects without a cron row
insert into rankly.project_cron_state (project_id, next_pagespeed_check_at)
select p.id, now()
from rankly.projects p
where not exists (
  select 1 from rankly.project_cron_state s where s.project_id = p.id
)
on conflict (project_id) do nothing;

update rankly.project_cron_state
set next_pagespeed_check_at = coalesce(next_pagespeed_check_at, now())
where next_pagespeed_check_at is null;

notify pgrst, 'reload schema';
