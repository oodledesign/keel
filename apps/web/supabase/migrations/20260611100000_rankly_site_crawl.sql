-- Technical site crawler (Screaming Frog–style internal crawl)

create table if not exists rankly.site_crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending',
  trigger_source text not null default 'manual',
  start_url text not null,
  url_limit integer not null default 1000,
  urls_crawled integer not null default 0,
  urls_discovered integer not null default 0,
  pending_urls jsonb not null default '[]'::jsonb,
  issue_summary jsonb not null default '{}'::jsonb,
  error_msg text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_crawl_jobs_status_check check (
    status in ('pending', 'running', 'done', 'error')
  ),
  constraint site_crawl_jobs_trigger_source_check check (
    trigger_source in ('manual', 'cron')
  ),
  constraint site_crawl_jobs_url_limit_check check (
    url_limit > 0 and url_limit <= 2000
  )
);

create index if not exists ix_site_crawl_jobs_project_id
  on rankly.site_crawl_jobs (project_id);

create index if not exists ix_site_crawl_jobs_status
  on rankly.site_crawl_jobs (status);

create table if not exists rankly.site_crawl_pages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.site_crawl_jobs (id) on delete cascade,
  project_id uuid not null references rankly.projects (id) on delete cascade,
  url text not null,
  final_url text,
  status_code integer not null default 0,
  title text not null default '',
  meta_description text not null default '',
  h1 text not null default '',
  h1_count integer not null default 0,
  canonical text not null default '',
  word_count integer not null default 0,
  indexable boolean not null default true,
  internal_links_out integer not null default 0,
  external_links_out integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  crawl_error text,
  crawled_at timestamptz not null default now(),
  constraint site_crawl_pages_job_url_unique unique (job_id, url)
);

create index if not exists ix_site_crawl_pages_job_id
  on rankly.site_crawl_pages (job_id);

create index if not exists ix_site_crawl_pages_project_id
  on rankly.site_crawl_pages (project_id);

drop trigger if exists rankly_site_crawl_jobs_set_timestamps on rankly.site_crawl_jobs;
create trigger rankly_site_crawl_jobs_set_timestamps
before update on rankly.site_crawl_jobs
for each row execute function public.trigger_set_timestamps();

alter table rankly.site_crawl_jobs enable row level security;
alter table rankly.site_crawl_pages enable row level security;

drop policy if exists rankly_site_crawl_jobs_rw on rankly.site_crawl_jobs;
create policy rankly_site_crawl_jobs_rw on rankly.site_crawl_jobs
for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.site_crawl_jobs.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.site_crawl_jobs.project_id
      and public.is_account_member(p.account_id)
  )
);

drop policy if exists rankly_site_crawl_pages_rw on rankly.site_crawl_pages;
create policy rankly_site_crawl_pages_rw on rankly.site_crawl_pages
for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.site_crawl_pages.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.site_crawl_pages.project_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.site_crawl_jobs to authenticated;
grant select, insert, update, delete on rankly.site_crawl_pages to authenticated;
grant all on rankly.site_crawl_jobs to postgres, service_role;
grant all on rankly.site_crawl_pages to postgres, service_role;

notify pgrst, 'reload schema';
