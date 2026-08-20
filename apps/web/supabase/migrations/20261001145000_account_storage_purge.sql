-- Queue storage cleanup 30 days after an account row is deleted.
-- Database rows cascade immediately; objects in Storage do not.

create table if not exists public.account_storage_purges (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '30 days'),
  purged_at timestamptz,
  objects_removed integer,
  status text not null default 'pending'
    check (status in ('pending', 'purged', 'failed')),
  error text,
  unique (account_id)
);

comment on table public.account_storage_purges is
  'Storage purge queue for deleted accounts. Policy: complete within 30 days of termination.';

create index if not exists account_storage_purges_due_idx
  on public.account_storage_purges (purge_after)
  where status in ('pending', 'failed');

alter table public.account_storage_purges enable row level security;

create policy account_storage_purges_super_admin
  on public.account_storage_purges
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke all on public.account_storage_purges from authenticated, service_role;
grant select, insert, update, delete on public.account_storage_purges to service_role;
grant select on public.account_storage_purges to authenticated;

create or replace function public.enqueue_account_storage_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_storage_purges (account_id)
  values (old.id)
  on conflict (account_id) do nothing;
  return old;
end;
$$;

drop trigger if exists accounts_enqueue_storage_purge on public.accounts;
create trigger accounts_enqueue_storage_purge
  after delete on public.accounts
  for each row
  execute function public.enqueue_account_storage_purge();
