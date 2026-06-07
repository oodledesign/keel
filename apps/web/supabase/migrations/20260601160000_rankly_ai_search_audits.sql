-- Rankly AI Search Audit (WebFetch + cheerio + DataForSEO + Claude)

create table if not exists rankly.ai_audit_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_domain text not null,
  status text not null default 'pending',
  error_msg text,
  pages_crawled int,
  credits_used int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_audit_jobs_status_check check (
    status in (
      'pending',
      'crawling',
      'extracting',
      'checking_citations',
      'scoring',
      'done',
      'error'
    )
  )
);

create index if not exists ix_ai_audit_jobs_project_id
  on rankly.ai_audit_jobs (project_id);

create index if not exists ix_ai_audit_jobs_user_id
  on rankly.ai_audit_jobs (user_id);

create table if not exists rankly.ai_audit_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.ai_audit_jobs (id) on delete cascade,
  project_id uuid not null references rankly.projects (id) on delete cascade,
  target_domain text not null,
  score_entity int,
  score_content int,
  score_eeat int,
  score_tech int,
  overall_score int,
  ai_cited boolean,
  ai_cited_queries text[],
  ai_competing_brands text[],
  crawl_data jsonb,
  executive_summary text,
  created_at timestamptz not null default now()
);

create index if not exists ix_ai_audit_reports_job_id
  on rankly.ai_audit_reports (job_id);

create index if not exists ix_ai_audit_reports_project_id
  on rankly.ai_audit_reports (project_id);

create table if not exists rankly.ai_audit_recommendations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references rankly.ai_audit_reports (id) on delete cascade,
  project_id uuid not null references rankly.projects (id) on delete cascade,
  dimension text not null,
  priority text not null,
  is_quick_win boolean not null default false,
  title text not null,
  description text not null,
  outcome text,
  why text,
  magnitude text,
  example_urls text[],
  fix_snippet text,
  is_starred boolean not null default false,
  display_order int,
  created_at timestamptz not null default now(),
  constraint ai_audit_recommendations_dimension_check check (
    dimension in ('entity', 'content', 'eeat', 'tech')
  ),
  constraint ai_audit_recommendations_priority_check check (
    priority in ('high', 'medium', 'low')
  )
);

create index if not exists ix_ai_audit_recommendations_report_id
  on rankly.ai_audit_recommendations (report_id);

create table if not exists rankly.ai_audit_score_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  report_id uuid not null references rankly.ai_audit_reports (id) on delete cascade,
  score_entity int,
  score_content int,
  score_eeat int,
  score_tech int,
  overall_score int,
  run_at timestamptz not null default now()
);

create index if not exists ix_ai_audit_score_history_project_id
  on rankly.ai_audit_score_history (project_id);

alter table rankly.ai_audit_jobs enable row level security;
alter table rankly.ai_audit_reports enable row level security;
alter table rankly.ai_audit_recommendations enable row level security;
alter table rankly.ai_audit_score_history enable row level security;

drop policy if exists rankly_ai_audit_jobs_rw on rankly.ai_audit_jobs;
create policy rankly_ai_audit_jobs_rw on rankly.ai_audit_jobs
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists rankly_ai_audit_reports_rw on rankly.ai_audit_reports;
create policy rankly_ai_audit_reports_rw on rankly.ai_audit_reports
for all to authenticated
using (
  job_id in (
    select id from rankly.ai_audit_jobs where user_id = auth.uid()
  )
)
with check (
  job_id in (
    select id from rankly.ai_audit_jobs where user_id = auth.uid()
  )
);

drop policy if exists rankly_ai_audit_recommendations_rw on rankly.ai_audit_recommendations;
create policy rankly_ai_audit_recommendations_rw on rankly.ai_audit_recommendations
for all to authenticated
using (
  report_id in (
    select r.id
    from rankly.ai_audit_reports r
    join rankly.ai_audit_jobs j on j.id = r.job_id
    where j.user_id = auth.uid()
  )
)
with check (
  report_id in (
    select r.id
    from rankly.ai_audit_reports r
    join rankly.ai_audit_jobs j on j.id = r.job_id
    where j.user_id = auth.uid()
  )
);

drop policy if exists rankly_ai_audit_score_history_rw on rankly.ai_audit_score_history;
create policy rankly_ai_audit_score_history_rw on rankly.ai_audit_score_history
for all to authenticated
using (
  project_id in (
    select distinct j.project_id
    from rankly.ai_audit_jobs j
    where j.user_id = auth.uid()
  )
)
with check (
  project_id in (
    select distinct j.project_id
    from rankly.ai_audit_jobs j
    where j.user_id = auth.uid()
  )
);

grant all on rankly.ai_audit_jobs to postgres, service_role;
grant all on rankly.ai_audit_reports to postgres, service_role;
grant all on rankly.ai_audit_recommendations to postgres, service_role;
grant all on rankly.ai_audit_score_history to postgres, service_role;

grant select, insert, update, delete on rankly.ai_audit_jobs to authenticated;
grant select, insert, update, delete on rankly.ai_audit_reports to authenticated;
grant select, insert, update, delete on rankly.ai_audit_recommendations to authenticated;
grant select, insert, update, delete on rankly.ai_audit_score_history to authenticated;

notify pgrst, 'reload schema';
