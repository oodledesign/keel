-- Allow SOP runs to be assigned to a workspace team member.

alter table sops.runs
  add column if not exists assigned_to uuid references auth.users (id) on delete set null;

create index if not exists sops_runs_assigned_to_idx
  on sops.runs (account_id, assigned_to)
  where assigned_to is not null;

comment on column sops.runs.assigned_to is
  'Team member responsible for completing this SOP run checklist.';

notify pgrst, 'reload schema';
