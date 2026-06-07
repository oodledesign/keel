-- Rankly Keyword Cluster Builder (DataForSEO-powered pillar + spokes plans)

create table if not exists rankly.keyword_cluster_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seeds text[] not null,
  country text not null default 'gb',
  min_volume int not null default 100,
  max_kd int not null default 60,
  status text not null default 'pending',
  error_msg text,
  credits_used int,
  candidate_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint keyword_cluster_jobs_status_check check (
    status in (
      'pending',
      'expanding',
      'awaiting_confirmation',
      'fetching_serps',
      'clustering',
      'saving',
      'done',
      'error'
    )
  )
);

create index if not exists ix_keyword_cluster_jobs_project_id
  on rankly.keyword_cluster_jobs (project_id);

create index if not exists ix_keyword_cluster_jobs_user_id
  on rankly.keyword_cluster_jobs (user_id);

create table if not exists rankly.keyword_clusters (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.keyword_cluster_jobs (id) on delete cascade,
  name text not null,
  role text not null,
  primary_keyword text not null,
  secondary_keywords text[],
  total_volume int,
  weighted_kd numeric(5, 1),
  priority_score numeric(6, 2),
  intent text,
  pillar_h1 text,
  pillar_h2s text[],
  build_order int,
  created_at timestamptz not null default now(),
  constraint keyword_clusters_role_check check (role in ('pillar', 'spoke-only'))
);

create index if not exists ix_keyword_clusters_job_id
  on rankly.keyword_clusters (job_id);

create table if not exists rankly.keyword_cluster_spokes (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references rankly.keyword_clusters (id) on delete cascade,
  title text not null,
  target_keyword text not null,
  volume int,
  h1 text,
  h2s text[],
  position int,
  created_at timestamptz not null default now()
);

create index if not exists ix_keyword_cluster_spokes_cluster_id
  on rankly.keyword_cluster_spokes (cluster_id);

create table if not exists rankly.keyword_cluster_keywords (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.keyword_cluster_jobs (id) on delete cascade,
  keyword text not null,
  volume int,
  kd numeric(5, 1),
  cpc numeric(8, 2),
  intent text,
  cluster_id uuid references rankly.keyword_clusters (id) on delete set null,
  role text,
  constraint keyword_cluster_keywords_role_check check (
    role is null or role in ('primary', 'secondary', 'excluded')
  )
);

create index if not exists ix_keyword_cluster_keywords_job_id
  on rankly.keyword_cluster_keywords (job_id);

create table if not exists rankly.keyword_cluster_quality (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.keyword_cluster_jobs (id) on delete cascade,
  gate text not null,
  status text not null,
  detail text,
  created_at timestamptz not null default now(),
  constraint keyword_cluster_quality_gate_check check (
    gate in ('cannibalisation', 'orphan', 'coverage', 'anchor_diversity')
  ),
  constraint keyword_cluster_quality_status_check check (
    status in ('pass', 'warn', 'fail')
  )
);

create index if not exists ix_keyword_cluster_quality_job_id
  on rankly.keyword_cluster_quality (job_id);

create table if not exists rankly.keyword_cluster_links (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.keyword_cluster_jobs (id) on delete cascade,
  from_cluster_id uuid references rankly.keyword_clusters (id) on delete cascade,
  to_cluster_id uuid references rankly.keyword_clusters (id) on delete cascade,
  link_type text,
  constraint keyword_cluster_links_type_check check (
    link_type is null
    or link_type in ('pillar_to_spoke', 'spoke_to_pillar', 'cross_link')
  )
);

create index if not exists ix_keyword_cluster_links_job_id
  on rankly.keyword_cluster_links (job_id);

drop trigger if exists keyword_cluster_jobs_set_timestamps on rankly.keyword_cluster_jobs;
create trigger keyword_cluster_jobs_set_timestamps
before update on rankly.keyword_cluster_jobs
for each row execute function public.trigger_set_timestamps();

alter table rankly.keyword_cluster_jobs enable row level security;
alter table rankly.keyword_clusters enable row level security;
alter table rankly.keyword_cluster_spokes enable row level security;
alter table rankly.keyword_cluster_keywords enable row level security;
alter table rankly.keyword_cluster_quality enable row level security;
alter table rankly.keyword_cluster_links enable row level security;

drop policy if exists rankly_keyword_cluster_jobs_rw on rankly.keyword_cluster_jobs;
create policy rankly_keyword_cluster_jobs_rw on rankly.keyword_cluster_jobs
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists rankly_keyword_clusters_rw on rankly.keyword_clusters;
create policy rankly_keyword_clusters_rw on rankly.keyword_clusters
for all to authenticated
using (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
)
with check (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
);

drop policy if exists rankly_keyword_cluster_spokes_rw on rankly.keyword_cluster_spokes;
create policy rankly_keyword_cluster_spokes_rw on rankly.keyword_cluster_spokes
for all to authenticated
using (
  cluster_id in (
    select c.id
    from rankly.keyword_clusters c
    join rankly.keyword_cluster_jobs j on j.id = c.job_id
    where j.user_id = auth.uid()
  )
)
with check (
  cluster_id in (
    select c.id
    from rankly.keyword_clusters c
    join rankly.keyword_cluster_jobs j on j.id = c.job_id
    where j.user_id = auth.uid()
  )
);

drop policy if exists rankly_keyword_cluster_keywords_rw on rankly.keyword_cluster_keywords;
create policy rankly_keyword_cluster_keywords_rw on rankly.keyword_cluster_keywords
for all to authenticated
using (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
)
with check (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
);

drop policy if exists rankly_keyword_cluster_quality_rw on rankly.keyword_cluster_quality;
create policy rankly_keyword_cluster_quality_rw on rankly.keyword_cluster_quality
for all to authenticated
using (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
)
with check (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
);

drop policy if exists rankly_keyword_cluster_links_rw on rankly.keyword_cluster_links;
create policy rankly_keyword_cluster_links_rw on rankly.keyword_cluster_links
for all to authenticated
using (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
)
with check (
  job_id in (
    select id from rankly.keyword_cluster_jobs where user_id = auth.uid()
  )
);

grant all on rankly.keyword_cluster_jobs to postgres, service_role;
grant all on rankly.keyword_clusters to postgres, service_role;
grant all on rankly.keyword_cluster_spokes to postgres, service_role;
grant all on rankly.keyword_cluster_keywords to postgres, service_role;
grant all on rankly.keyword_cluster_quality to postgres, service_role;
grant all on rankly.keyword_cluster_links to postgres, service_role;

grant select, insert, update, delete on rankly.keyword_cluster_jobs to authenticated;
grant select, insert, update, delete on rankly.keyword_clusters to authenticated;
grant select, insert, update, delete on rankly.keyword_cluster_spokes to authenticated;
grant select, insert, update, delete on rankly.keyword_cluster_keywords to authenticated;
grant select, insert, update, delete on rankly.keyword_cluster_quality to authenticated;
grant select, insert, update, delete on rankly.keyword_cluster_links to authenticated;

notify pgrst, 'reload schema';
