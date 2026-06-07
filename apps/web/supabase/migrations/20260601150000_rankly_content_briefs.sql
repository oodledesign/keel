-- Rankly Content Brief generator (DataForSEO + Claude)

create table if not exists rankly.content_brief_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  spoke_id uuid references rankly.keyword_cluster_spokes (id) on delete set null,
  target_domain text not null,
  target_keyword text,
  country text not null default 'gb',
  mode text not null default 'full',
  status text not null default 'pending',
  error_msg text,
  credits_used int,
  topic_reasoning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_brief_jobs_mode_check check (mode in ('full', 'quick')),
  constraint content_brief_jobs_status_check check (
    status in (
      'pending',
      'domain_overview',
      'competitor_discovery',
      'keyword_gap',
      'serp_analysis',
      'scraping_competitors',
      'classifying',
      'internal_links',
      'synthesising',
      'done',
      'error'
    )
  )
);

create index if not exists ix_content_brief_jobs_project_id
  on rankly.content_brief_jobs (project_id);

create index if not exists ix_content_brief_jobs_user_id
  on rankly.content_brief_jobs (user_id);

create table if not exists rankly.content_briefs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.content_brief_jobs (id) on delete cascade,
  project_id uuid not null references rankly.projects (id) on delete cascade,
  target_keyword text not null,
  primary_keyword text,
  secondary_keywords text[],
  template_type text,
  template_rationale text,
  title_options text[],
  suggested_meta_desc text,
  h1 text,
  outline jsonb,
  content_gaps text[],
  word_count_target int,
  word_count_min int,
  word_count_max int,
  competitor_avg_wc int,
  suggested_links jsonb,
  ai_cited_brands text[],
  ai_search_actions text[],
  traffic_position_1_3 int,
  traffic_position_5 int,
  serp_snapshot jsonb,
  competitor_data jsonb,
  domain_keywords jsonb,
  tone_notes text,
  eeat_notes text,
  angle text,
  required_assets text,
  created_at timestamptz not null default now()
);

create index if not exists ix_content_briefs_job_id
  on rankly.content_briefs (job_id);

create index if not exists ix_content_briefs_project_id
  on rankly.content_briefs (project_id);

alter table rankly.content_brief_jobs enable row level security;
alter table rankly.content_briefs enable row level security;

drop policy if exists rankly_content_brief_jobs_rw on rankly.content_brief_jobs;
create policy rankly_content_brief_jobs_rw on rankly.content_brief_jobs
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists rankly_content_briefs_rw on rankly.content_briefs;
create policy rankly_content_briefs_rw on rankly.content_briefs
for all to authenticated
using (
  job_id in (
    select id from rankly.content_brief_jobs where user_id = auth.uid()
  )
)
with check (
  job_id in (
    select id from rankly.content_brief_jobs where user_id = auth.uid()
  )
);

grant all on rankly.content_brief_jobs to postgres, service_role;
grant all on rankly.content_briefs to postgres, service_role;

grant select, insert, update, delete on rankly.content_brief_jobs to authenticated;
grant select, insert, update, delete on rankly.content_briefs to authenticated;

notify pgrst, 'reload schema';
