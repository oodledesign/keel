-- Per-keyword rank check task queue (SaaS-safe worker pattern)

create table if not exists rankly.rank_check_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rankly.rank_check_jobs (id) on delete cascade,
  keyword_id uuid not null references rankly.keywords (id) on delete cascade,
  device text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  error_msg text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rank_check_tasks_device_check check (device in ('desktop', 'mobile')),
  constraint rank_check_tasks_status_check check (
    status in ('pending', 'processing', 'done', 'error')
  ),
  constraint rank_check_tasks_job_keyword_device_key unique (job_id, keyword_id, device)
);

create index if not exists ix_rank_check_tasks_job_id
  on rankly.rank_check_tasks (job_id);

create index if not exists ix_rank_check_tasks_pending
  on rankly.rank_check_tasks (job_id, created_at)
  where status = 'pending';

alter table rankly.rank_check_jobs
  add column if not exists last_worker_trigger_at timestamptz;

drop trigger if exists rankly_rank_check_tasks_set_timestamps on rankly.rank_check_tasks;
create trigger rankly_rank_check_tasks_set_timestamps
before update on rankly.rank_check_tasks
for each row execute function public.trigger_set_timestamps();

alter table rankly.rank_check_tasks enable row level security;

drop policy if exists rankly_rank_check_tasks_rw on rankly.rank_check_tasks;
create policy rankly_rank_check_tasks_rw on rankly.rank_check_tasks
for all
to authenticated
using (
  exists (
    select 1
    from rankly.rank_check_jobs j
    join rankly.projects p on p.id = j.project_id
    where j.id = rankly.rank_check_tasks.job_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1
    from rankly.rank_check_jobs j
    join rankly.projects p on p.id = j.project_id
    where j.id = rankly.rank_check_tasks.job_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.rank_check_tasks to authenticated;
grant all on rankly.rank_check_tasks to postgres, service_role;

create or replace function rankly.claim_rank_check_tasks(
  p_job_id uuid,
  p_limit integer,
  p_worker_id text
)
returns setof rankly.rank_check_tasks
language plpgsql
security definer
set search_path = rankly, public
as $$
begin
  return query
  update rankly.rank_check_tasks t
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    attempts = t.attempts + 1,
    updated_at = now()
  where t.id in (
    select id
    from rankly.rank_check_tasks
    where job_id = p_job_id
      and status = 'pending'
    order by created_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning *;
end;
$$;

create or replace function rankly.release_stale_rank_check_tasks(
  p_stale_minutes integer default 10
)
returns integer
language plpgsql
security definer
set search_path = rankly, public
as $$
declare
  released_count integer;
begin
  update rankly.rank_check_tasks
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => p_stale_minutes);

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

grant execute on function rankly.claim_rank_check_tasks(uuid, integer, text) to service_role;
grant execute on function rankly.release_stale_rank_check_tasks(integer) to service_role;

notify pgrst, 'reload schema';
