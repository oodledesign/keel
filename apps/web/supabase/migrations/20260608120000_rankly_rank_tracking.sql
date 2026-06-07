-- Rank tracking jobs, refresh schedule, and cron scheduling

alter table rankly.projects
  add column if not exists rank_refresh_interval text not null default 'weekly';

alter table rankly.projects
  drop constraint if exists rankly_projects_rank_refresh_interval_check;

alter table rankly.projects
  add constraint rankly_projects_rank_refresh_interval_check
  check (rank_refresh_interval in ('manual', 'daily', 'weekly', 'monthly'));

comment on column rankly.projects.rank_refresh_interval is
  'How often Rankly refreshes SERP positions: manual, daily, weekly, or monthly.';

alter table rankly.project_cron_state
  add column if not exists next_rank_check_at timestamptz;

create table if not exists rankly.rank_check_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending',
  trigger_source text not null default 'manual',
  keyword_count integer not null default 0,
  device_count integer not null default 1,
  tasks_completed integer not null default 0,
  tasks_total integer not null default 0,
  api_cost_usd numeric not null default 0,
  estimated_cost_usd numeric,
  error_msg text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rank_check_jobs_status_check check (
    status in ('pending', 'running', 'done', 'error')
  ),
  constraint rank_check_jobs_trigger_source_check check (
    trigger_source in ('manual', 'cron')
  )
);

create index if not exists ix_rank_check_jobs_project_id
  on rankly.rank_check_jobs (project_id);

create index if not exists ix_rank_check_jobs_status
  on rankly.rank_check_jobs (status);

drop trigger if exists rankly_rank_check_jobs_set_timestamps on rankly.rank_check_jobs;
create trigger rankly_rank_check_jobs_set_timestamps
before update on rankly.rank_check_jobs
for each row execute function public.trigger_set_timestamps();

alter table rankly.rank_check_jobs enable row level security;

drop policy if exists rankly_rank_check_jobs_rw on rankly.rank_check_jobs;
create policy rankly_rank_check_jobs_rw on rankly.rank_check_jobs
for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.rank_check_jobs.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.rank_check_jobs.project_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.rank_check_jobs to authenticated;
grant all on rankly.rank_check_jobs to postgres, service_role;

-- Backfill cron rows for existing projects (weekly schedule starts immediately)
insert into rankly.project_cron_state (project_id, next_rank_check_at)
select p.id, now()
from rankly.projects p
where not exists (
  select 1 from rankly.project_cron_state s where s.project_id = p.id
)
on conflict (project_id) do nothing;

notify pgrst, 'reload schema';
