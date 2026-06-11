-- SOPs module: playbooks (process templates), steps, runs (checklist instances), step completion.

create schema if not exists sops;

-- ---------- playbooks (reusable process definitions) ----------
create table if not exists sops.playbooks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text not null,
  description text,
  category text,
  recurrence text not null default 'ad_hoc' check (
    recurrence in ('monthly', 'weekly', 'project', 'ad_hoc')
  ),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sops_playbooks_account_id_idx
  on sops.playbooks (account_id);

drop trigger if exists sops_playbooks_set_timestamps on sops.playbooks;
create trigger sops_playbooks_set_timestamps
before update on sops.playbooks
for each row
execute procedure public.trigger_set_timestamps();

-- ---------- playbook_steps ----------
create table if not exists sops.playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references sops.playbooks (id) on delete cascade,
  position integer not null default 0,
  title text not null,
  body_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (playbook_id, position)
);

create index if not exists sops_playbook_steps_playbook_id_idx
  on sops.playbook_steps (playbook_id, position);

drop trigger if exists sops_playbook_steps_set_timestamps on sops.playbook_steps;
create trigger sops_playbook_steps_set_timestamps
before update on sops.playbook_steps
for each row
execute procedure public.trigger_set_timestamps();

-- ---------- runs (one execution: a month, project, or ad-hoc pass) ----------
create table if not exists sops.runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  playbook_id uuid not null references sops.playbooks (id) on delete cascade,
  title text not null,
  period_label text,
  notes_md text,
  status text not null default 'active' check (
    status in ('active', 'completed', 'archived')
  ),
  client_id uuid references public.clients (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  started_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sops_runs_account_id_idx
  on sops.runs (account_id, created_at desc);

create index if not exists sops_runs_playbook_id_idx
  on sops.runs (playbook_id, created_at desc);

drop trigger if exists sops_runs_set_timestamps on sops.runs;
create trigger sops_runs_set_timestamps
before update on sops.runs
for each row
execute procedure public.trigger_set_timestamps();

-- ---------- run_step_states (snapshot + checklist per run) ----------
create table if not exists sops.run_step_states (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references sops.runs (id) on delete cascade,
  playbook_step_id uuid references sops.playbook_steps (id) on delete set null,
  position integer not null default 0,
  title text not null,
  body_md text,
  is_complete boolean not null default false,
  step_notes text,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (run_id, position)
);

create index if not exists sops_run_step_states_run_id_idx
  on sops.run_step_states (run_id, position);

-- ---------- RLS ----------
alter table sops.playbooks enable row level security;
alter table sops.playbook_steps enable row level security;
alter table sops.runs enable row level security;
alter table sops.run_step_states enable row level security;

-- playbooks
drop policy if exists sops_playbooks_select on sops.playbooks;
create policy sops_playbooks_select on sops.playbooks
  for select to authenticated
  using (public.is_account_member(account_id));

drop policy if exists sops_playbooks_insert on sops.playbooks;
create policy sops_playbooks_insert on sops.playbooks
  for insert to authenticated
  with check (public.is_account_member(account_id));

drop policy if exists sops_playbooks_update on sops.playbooks;
create policy sops_playbooks_update on sops.playbooks
  for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));

drop policy if exists sops_playbooks_delete on sops.playbooks;
create policy sops_playbooks_delete on sops.playbooks
  for delete to authenticated
  using (public.is_account_admin(account_id));

-- playbook_steps (via playbook account)
drop policy if exists sops_playbook_steps_select on sops.playbook_steps;
create policy sops_playbook_steps_select on sops.playbook_steps
  for select to authenticated
  using (
    exists (
      select 1 from sops.playbooks p
      where p.id = playbook_steps.playbook_id
        and public.is_account_member(p.account_id)
    )
  );

drop policy if exists sops_playbook_steps_mutate on sops.playbook_steps;
create policy sops_playbook_steps_mutate on sops.playbook_steps
  for all to authenticated
  using (
    exists (
      select 1 from sops.playbooks p
      where p.id = playbook_steps.playbook_id
        and public.is_account_member(p.account_id)
    )
  )
  with check (
    exists (
      select 1 from sops.playbooks p
      where p.id = playbook_steps.playbook_id
        and public.is_account_member(p.account_id)
    )
  );

-- runs
drop policy if exists sops_runs_select on sops.runs;
create policy sops_runs_select on sops.runs
  for select to authenticated
  using (public.is_account_member(account_id));

drop policy if exists sops_runs_insert on sops.runs;
create policy sops_runs_insert on sops.runs
  for insert to authenticated
  with check (public.is_account_member(account_id));

drop policy if exists sops_runs_update on sops.runs;
create policy sops_runs_update on sops.runs
  for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));

drop policy if exists sops_runs_delete on sops.runs;
create policy sops_runs_delete on sops.runs
  for delete to authenticated
  using (public.is_account_admin(account_id));

-- run_step_states (via run account)
drop policy if exists sops_run_step_states_select on sops.run_step_states;
create policy sops_run_step_states_select on sops.run_step_states
  for select to authenticated
  using (
    exists (
      select 1 from sops.runs r
      where r.id = run_step_states.run_id
        and public.is_account_member(r.account_id)
    )
  );

drop policy if exists sops_run_step_states_mutate on sops.run_step_states;
create policy sops_run_step_states_mutate on sops.run_step_states
  for all to authenticated
  using (
    exists (
      select 1 from sops.runs r
      where r.id = run_step_states.run_id
        and public.is_account_member(r.account_id)
    )
  )
  with check (
    exists (
      select 1 from sops.runs r
      where r.id = run_step_states.run_id
        and public.is_account_member(r.account_id)
    )
  );

grant usage on schema sops to authenticated, service_role;
grant all on all tables in schema sops to postgres, service_role;
grant select, insert, update, delete on all tables in schema sops to authenticated;

-- Module toggle + seed for business workspaces
insert into public.account_module_settings (account_id, module_key, enabled)
select id, 'sops', true
from public.accounts
where is_personal_account = false
  and coalesce(space_type, 'work') = 'work'
on conflict (account_id, module_key) do nothing;

-- Extend seed function for new work workspaces
CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text,
  p_business_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  keys text[];
  k text;
  normalized_space text;
  normalized_biz text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'calendar', 'meal_plan', 'shopping',
      'notes', 'team', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

notify pgrst, 'reload schema';

-- PostgREST (hosted): add sops schema alongside other module schemas
ALTER ROLE authenticator SET
  pgrst.db_schemas = 'public, storage, graphql_public, feedflow, rankly, platform_merge, signatures, sops';

NOTIFY pgrst, 'reload config';
