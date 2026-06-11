-- Platform support tickets (user → Keel team, super-admin triage).

create table if not exists public.platform_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users (id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_support_tickets_user_id_idx
  on public.platform_support_tickets (user_id);

create index if not exists platform_support_tickets_status_idx
  on public.platform_support_tickets (status);

alter table public.platform_support_tickets enable row level security;

create policy platform_support_tickets_user_read on public.platform_support_tickets
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin ()
  );

create policy platform_support_tickets_user_insert on public.platform_support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

create policy platform_support_tickets_super_admin_write on public.platform_support_tickets
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

grant select, insert on public.platform_support_tickets to authenticated;
grant all on public.platform_support_tickets to service_role;
