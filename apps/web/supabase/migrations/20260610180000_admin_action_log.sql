-- Super-admin action audit trail (grants, billing exempt, etc.).

create table if not exists public.admin_action_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  target_account_id uuid references public.accounts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_action_log_created_at_idx
  on public.admin_action_log (created_at desc);

create index if not exists admin_action_log_actor_user_id_idx
  on public.admin_action_log (actor_user_id);

alter table public.admin_action_log enable row level security;

create policy admin_action_log_super_admin_read on public.admin_action_log
  for select to authenticated
  using (public.is_super_admin ());

grant select on public.admin_action_log to authenticated;
grant all on public.admin_action_log to service_role;
