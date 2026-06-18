-- Rankly: project brief settings, page optimization jobs, batch brief support

alter table rankly.projects
  add column if not exists brief_brand_name text,
  add column if not exists brief_voice_notes text,
  add column if not exists brief_mention_rules text,
  add column if not exists brief_research_depth text not null default 'standard';

alter table rankly.projects
  drop constraint if exists projects_brief_research_depth_check;

alter table rankly.projects
  add constraint projects_brief_research_depth_check
  check (brief_research_depth in ('standard', 'deep'));

create table if not exists rankly.page_optimization_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_url text not null,
  target_keyword text,
  country text not null default 'gb',
  status text not null default 'pending',
  error_msg text,
  credits_used integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_optimization_jobs_status_check check (
    status in (
      'pending',
      'scraping',
      'detecting_keyword',
      'serp_analysis',
      'scraping_competitors',
      'analysing',
      'done',
      'error'
    )
  )
);

create index if not exists ix_page_optimization_jobs_project_id
  on rankly.page_optimization_jobs (project_id);

create index if not exists ix_page_optimization_jobs_user_id
  on rankly.page_optimization_jobs (user_id);

create table if not exists rankly.page_optimization_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.page_optimization_jobs (id) on delete cascade,
  project_id uuid not null references rankly.projects (id) on delete cascade,
  source_url text not null,
  target_keyword text not null,
  page_snapshot jsonb,
  serp_snapshot jsonb,
  competitor_data jsonb,
  score integer,
  recommendations jsonb not null default '[]'::jsonb,
  title_suggestions jsonb,
  meta_suggestion text,
  rewrite_summary text,
  created_at timestamptz not null default now(),
  unique (job_id)
);

create index if not exists ix_page_optimization_reports_project_id
  on rankly.page_optimization_reports (project_id);

alter table rankly.page_optimization_jobs enable row level security;
alter table rankly.page_optimization_reports enable row level security;

drop policy if exists rankly_page_optimization_jobs_rw on rankly.page_optimization_jobs;
create policy rankly_page_optimization_jobs_rw on rankly.page_optimization_jobs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists rankly_page_optimization_reports_rw on rankly.page_optimization_reports;
create policy rankly_page_optimization_reports_rw on rankly.page_optimization_reports
  for all using (
    job_id in (
      select id from rankly.page_optimization_jobs where user_id = auth.uid()
    )
  )
  with check (
    job_id in (
      select id from rankly.page_optimization_jobs where user_id = auth.uid()
    )
  );

grant all on rankly.page_optimization_jobs to postgres, service_role;
grant all on rankly.page_optimization_reports to postgres, service_role;
grant select, insert, update, delete on rankly.page_optimization_jobs to authenticated;
grant select, insert, update, delete on rankly.page_optimization_reports to authenticated;
