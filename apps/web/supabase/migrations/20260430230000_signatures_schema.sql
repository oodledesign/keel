-- Signatures module: Microsoft 365 connection, staff directory, HTML templates, push audit log.

create schema if not exists signatures;

-- ---------- ms_connections (one Microsoft tenant per Keel account) ----------
create table if not exists signatures.ms_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  ms_tenant_id text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  connected_by uuid references auth.users (id) on delete set null,
  unique (account_id)
);

-- ---------- staff ----------
create table if not exists signatures.staff (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  ms_user_id text,
  email text not null,
  full_name text,
  job_title text,
  department text,
  phone_direct text,
  phone_mobile text,
  branch text,
  photo_url text,
  signature_status text not null default 'pending' check (
    signature_status in ('pending', 'pushed', 'error')
  ),
  signature_pushed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

-- ---------- templates ----------
create table if not exists signatures.templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  html_template text not null,
  is_default boolean not null default false,
  preview_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists signatures_templates_set_timestamps on signatures.templates;
create trigger signatures_templates_set_timestamps
before update on signatures.templates
for each row
execute procedure public.trigger_set_timestamps();

-- ---------- staff_templates (junction) ----------
create table if not exists signatures.staff_templates (
  staff_id uuid not null references signatures.staff (id) on delete cascade,
  template_id uuid not null references signatures.templates (id) on delete cascade,
  primary key (staff_id, template_id)
);

-- ---------- push_log ----------
create table if not exists signatures.push_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  staff_id uuid not null references signatures.staff (id) on delete cascade,
  pushed_by uuid references auth.users (id) on delete set null,
  pushed_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  error_message text
);

-- ---------- RLS ----------
alter table signatures.ms_connections enable row level security;
alter table signatures.staff enable row level security;
alter table signatures.templates enable row level security;
alter table signatures.staff_templates enable row level security;
alter table signatures.push_log enable row level security;

-- ms_connections: members read; admins write; service_role full
drop policy if exists signatures_ms_connections_select on signatures.ms_connections;
create policy signatures_ms_connections_select on signatures.ms_connections
for select to authenticated
using (public.is_account_member(account_id));

drop policy if exists signatures_ms_connections_insert on signatures.ms_connections;
create policy signatures_ms_connections_insert on signatures.ms_connections
for insert to authenticated
with check (public.is_account_admin(account_id));

drop policy if exists signatures_ms_connections_update on signatures.ms_connections;
create policy signatures_ms_connections_update on signatures.ms_connections
for update to authenticated
using (public.is_account_admin(account_id))
with check (public.is_account_admin(account_id));

drop policy if exists signatures_ms_connections_delete on signatures.ms_connections;
create policy signatures_ms_connections_delete on signatures.ms_connections
for delete to authenticated
using (public.is_account_admin(account_id));

drop policy if exists signatures_ms_connections_service_role on signatures.ms_connections;
create policy signatures_ms_connections_service_role on signatures.ms_connections
for all to service_role
using (true)
with check (true);

-- staff
drop policy if exists signatures_staff_select on signatures.staff;
create policy signatures_staff_select on signatures.staff
for select to authenticated
using (public.is_account_member(account_id));

drop policy if exists signatures_staff_insert on signatures.staff;
create policy signatures_staff_insert on signatures.staff
for insert to authenticated
with check (public.is_account_admin(account_id));

drop policy if exists signatures_staff_update on signatures.staff;
create policy signatures_staff_update on signatures.staff
for update to authenticated
using (public.is_account_admin(account_id))
with check (public.is_account_admin(account_id));

drop policy if exists signatures_staff_delete on signatures.staff;
create policy signatures_staff_delete on signatures.staff
for delete to authenticated
using (public.is_account_admin(account_id));

-- templates
drop policy if exists signatures_templates_select on signatures.templates;
create policy signatures_templates_select on signatures.templates
for select to authenticated
using (public.is_account_member(account_id));

drop policy if exists signatures_templates_insert on signatures.templates;
create policy signatures_templates_insert on signatures.templates
for insert to authenticated
with check (public.is_account_admin(account_id));

drop policy if exists signatures_templates_update on signatures.templates;
create policy signatures_templates_update on signatures.templates
for update to authenticated
using (public.is_account_admin(account_id))
with check (public.is_account_admin(account_id));

drop policy if exists signatures_templates_delete on signatures.templates;
create policy signatures_templates_delete on signatures.templates
for delete to authenticated
using (public.is_account_admin(account_id));

-- staff_templates (junction): scope via staff.account_id / templates.account_id
drop policy if exists signatures_staff_templates_select on signatures.staff_templates;
create policy signatures_staff_templates_select on signatures.staff_templates
for select to authenticated
using (
  exists (
    select 1
    from signatures.staff s
    where s.id = staff_templates.staff_id
      and public.is_account_member(s.account_id)
  )
);

drop policy if exists signatures_staff_templates_insert on signatures.staff_templates;
create policy signatures_staff_templates_insert on signatures.staff_templates
for insert to authenticated
with check (
  exists (
    select 1
    from signatures.staff s
    inner join signatures.templates t on t.id = staff_templates.template_id
    where s.id = staff_templates.staff_id
      and s.account_id = t.account_id
      and public.is_account_admin(s.account_id)
  )
);

drop policy if exists signatures_staff_templates_update on signatures.staff_templates;
create policy signatures_staff_templates_update on signatures.staff_templates
for update to authenticated
using (
  exists (
    select 1
    from signatures.staff s
    where s.id = staff_templates.staff_id
      and public.is_account_admin(s.account_id)
  )
)
with check (
  exists (
    select 1
    from signatures.staff s
    inner join signatures.templates t on t.id = staff_templates.template_id
    where s.id = staff_templates.staff_id
      and s.account_id = t.account_id
      and public.is_account_admin(s.account_id)
  )
);

drop policy if exists signatures_staff_templates_delete on signatures.staff_templates;
create policy signatures_staff_templates_delete on signatures.staff_templates
for delete to authenticated
using (
  exists (
    select 1
    from signatures.staff s
    where s.id = staff_templates.staff_id
      and public.is_account_admin(s.account_id)
  )
);

-- push_log
drop policy if exists signatures_push_log_select on signatures.push_log;
create policy signatures_push_log_select on signatures.push_log
for select to authenticated
using (public.is_account_member(account_id));

drop policy if exists signatures_push_log_insert on signatures.push_log;
create policy signatures_push_log_insert on signatures.push_log
for insert to authenticated
with check (public.is_account_admin(account_id));

drop policy if exists signatures_push_log_update on signatures.push_log;
create policy signatures_push_log_update on signatures.push_log
for update to authenticated
using (public.is_account_admin(account_id))
with check (public.is_account_admin(account_id));

drop policy if exists signatures_push_log_delete on signatures.push_log;
create policy signatures_push_log_delete on signatures.push_log
for delete to authenticated
using (public.is_account_admin(account_id));

drop policy if exists signatures_push_log_service_role on signatures.push_log;
create policy signatures_push_log_service_role on signatures.push_log
for all to service_role
using (true)
with check (true);

-- ---------- Grants (match feedflow pattern in 20260430210000) ----------
grant usage on schema signatures to authenticated, service_role;
grant all on all tables in schema signatures to postgres, service_role;
grant select, insert, update, delete on all tables in schema signatures to authenticated;

-- Default module toggle for existing team accounts (enabled by default)
insert into public.account_module_settings (account_id, module_key, enabled)
select id, 'signatures', true
from public.accounts
where is_personal_account = false
on conflict (account_id, module_key) do nothing;

notify pgrst, 'reload schema';
