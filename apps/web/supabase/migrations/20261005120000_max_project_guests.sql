-- Project guest allowance on workspace plan limits (Business graduated seats).
alter table public.account_plan_limits
  add column if not exists max_project_guests integer;

comment on column public.account_plan_limits.max_project_guests is
  'Max project_guests (pending+accepted) for the workspace; NULL = unlimited / not enforced.';

-- Seed Lite workspaces that already have plan limits.
update public.account_plan_limits
set max_project_guests = 1
where plan_family = 'business_lite'
  and max_project_guests is null;
