-- Per-workspace customisable delivery project statuses.

create table if not exists public.project_statuses (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  slug text not null,
  label text not null,
  color text not null default '#41606F',
  sort_order integer not null default 0,
  is_default boolean not null default false,
  category text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (account_id, slug),
  constraint project_statuses_slug_format
    check (slug ~ '^[a-z][a-z0-9_]{0,47}$'),
  constraint project_statuses_label_len
    check (char_length(btrim(label)) between 1 and 40),
  constraint project_statuses_color_hex
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint project_statuses_category_check
    check (category in ('open', 'completed', 'cancelled'))
);

comment on table public.project_statuses is
  'Workspace-defined delivery project statuses (label, colour, order). projects.status stores the slug.';

comment on column public.project_statuses.slug is
  'Stable key stored on public.projects.status for this workspace.';

comment on column public.project_statuses.category is
  'open = active pipeline; completed / cancelled are closed tabs.';

comment on column public.project_statuses.is_default is
  'Default status assigned to new delivery projects in this workspace.';

create index if not exists ix_project_statuses_account_id
  on public.project_statuses (account_id, sort_order);

create unique index if not exists uq_project_statuses_account_default
  on public.project_statuses (account_id)
  where is_default;

drop trigger if exists project_statuses_set_timestamps on public.project_statuses;
create trigger project_statuses_set_timestamps
  before insert or update on public.project_statuses
  for each row execute function public.trigger_set_timestamps();

alter table public.project_statuses enable row level security;

revoke all on public.project_statuses from authenticated, service_role;
grant select, insert, update, delete on table public.project_statuses to authenticated;
grant all on table public.project_statuses to service_role;

create policy project_statuses_select
  on public.project_statuses
  for select
  to authenticated
  using (
    account_id = (select auth.uid())
    or public.has_role_on_account(account_id)
  );

create policy project_statuses_insert
  on public.project_statuses
  for insert
  to authenticated
  with check (
    account_id = (select auth.uid())
    or public.is_account_admin(account_id)
  );

create policy project_statuses_update
  on public.project_statuses
  for update
  to authenticated
  using (
    account_id = (select auth.uid())
    or public.is_account_admin(account_id)
  )
  with check (
    account_id = (select auth.uid())
    or public.is_account_admin(account_id)
  );

create policy project_statuses_delete
  on public.project_statuses
  for delete
  to authenticated
  using (
    account_id = (select auth.uid())
    or public.is_account_admin(account_id)
  );

-- Seed / validation / mutation functions live in
-- apps/web/supabase/migrations/20261124120000_workspace_project_statuses.sql
-- (_seed_default_project_statuses, seed_default_project_statuses,
--  enforce_delivery_project_status, reorder_workspace_project_statuses,
--  delete_workspace_project_status).
