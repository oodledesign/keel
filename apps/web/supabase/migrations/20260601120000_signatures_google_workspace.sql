-- Google Workspace connection for Signatures (domain-wide delegation + Directory/Gmail APIs).

create table if not exists signatures.google_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  primary_domain text not null,
  delegated_admin_email text not null,
  connected_at timestamptz not null default now(),
  connected_by uuid references auth.users (id) on delete set null,
  unique (account_id)
);

alter table signatures.staff add column if not exists google_user_id text;

create index if not exists ix_signatures_staff_google_user_id
  on signatures.staff (account_id, google_user_id)
  where google_user_id is not null;

alter table signatures.google_connections enable row level security;

drop policy if exists signatures_google_connections_select on signatures.google_connections;
create policy signatures_google_connections_select on signatures.google_connections
for select to authenticated
using (public.is_account_member(account_id));

drop policy if exists signatures_google_connections_insert on signatures.google_connections;
create policy signatures_google_connections_insert on signatures.google_connections
for insert to authenticated
with check (public.is_account_admin(account_id));

drop policy if exists signatures_google_connections_update on signatures.google_connections;
create policy signatures_google_connections_update on signatures.google_connections
for update to authenticated
using (public.is_account_admin(account_id))
with check (public.is_account_admin(account_id));

drop policy if exists signatures_google_connections_delete on signatures.google_connections;
create policy signatures_google_connections_delete on signatures.google_connections
for delete to authenticated
using (public.is_account_admin(account_id));

drop policy if exists signatures_google_connections_service_role on signatures.google_connections;
create policy signatures_google_connections_service_role on signatures.google_connections
for all to service_role
using (true)
with check (true);

grant select, insert, update, delete on signatures.google_connections to authenticated;

notify pgrst, 'reload schema';
