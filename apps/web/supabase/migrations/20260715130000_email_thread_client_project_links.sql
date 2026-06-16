-- Link Gmail threads to workspace clients and projects.

alter table public.email_threads
  add column if not exists account_id uuid references public.accounts (id) on delete set null,
  add column if not exists client_id uuid references public.clients (id) on delete set null,
  add column if not exists project_id uuid references public.projects (id) on delete set null,
  add column if not exists link_source text;

alter table public.email_threads
  drop constraint if exists email_threads_link_source_check;

alter table public.email_threads
  add constraint email_threads_link_source_check
  check (link_source is null or link_source in ('auto', 'manual'));

create index if not exists idx_email_threads_user_client
  on public.email_threads (user_id, client_id)
  where client_id is not null;

create index if not exists idx_email_threads_user_project
  on public.email_threads (user_id, project_id)
  where project_id is not null;

create index if not exists idx_email_threads_user_account
  on public.email_threads (user_id, account_id)
  where account_id is not null;
