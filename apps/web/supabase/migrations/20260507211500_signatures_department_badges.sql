-- Department-level award badge mapping for signature templates.

create table if not exists signatures.department_badges (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  department text not null,
  award_badge_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, department)
);

drop trigger if exists signatures_department_badges_set_timestamps on signatures.department_badges;
create trigger signatures_department_badges_set_timestamps
before update on signatures.department_badges
for each row
execute procedure public.trigger_set_timestamps();

alter table signatures.department_badges enable row level security;

drop policy if exists signatures_department_badges_select on signatures.department_badges;
create policy signatures_department_badges_select on signatures.department_badges
for select to authenticated
using (public.is_account_member(account_id));

drop policy if exists signatures_department_badges_insert on signatures.department_badges;
create policy signatures_department_badges_insert on signatures.department_badges
for insert to authenticated
with check (public.is_account_admin(account_id));

drop policy if exists signatures_department_badges_update on signatures.department_badges;
create policy signatures_department_badges_update on signatures.department_badges
for update to authenticated
using (public.is_account_admin(account_id))
with check (public.is_account_admin(account_id));

drop policy if exists signatures_department_badges_delete on signatures.department_badges;
create policy signatures_department_badges_delete on signatures.department_badges
for delete to authenticated
using (public.is_account_admin(account_id));

drop policy if exists signatures_department_badges_service_role on signatures.department_badges;
create policy signatures_department_badges_service_role on signatures.department_badges
for all to service_role
using (true)
with check (true);

grant all on signatures.department_badges to postgres, service_role;
grant select, insert, update, delete on signatures.department_badges to authenticated;

notify pgrst, 'reload schema';
