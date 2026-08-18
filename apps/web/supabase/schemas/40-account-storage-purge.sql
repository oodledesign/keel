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
  owner_email text,
  account_name text,
  notice_14d_sent_at timestamptz,
  notice_3d_sent_at timestamptz,
  unique (account_id)
);

comment on table public.account_storage_purges is
  'Storage purge queue for deleted accounts. Policy: wipe remaining files 30 days after deletion, with owner emails at 14 and 3 days remaining.';

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

create or replace function public.prepare_account_storage_purge(
  target_account_id uuid,
  target_email text default null,
  target_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_storage_purges (
    account_id,
    owner_email,
    account_name
  )
  values (
    target_account_id,
    nullif(trim(target_email), ''),
    nullif(trim(target_name), '')
  )
  on conflict (account_id) do update
    set
      owner_email = coalesce(
        excluded.owner_email,
        public.account_storage_purges.owner_email
      ),
      account_name = coalesce(
        excluded.account_name,
        public.account_storage_purges.account_name
      );
end;
$$;

-- `public` covers anon; authenticated is revoked separately.
revoke all on function public.prepare_account_storage_purge(uuid, text, text)
  from public, authenticated;
grant execute on function public.prepare_account_storage_purge(uuid, text, text)
  to service_role;

create or replace function public.enqueue_account_storage_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_email text;
begin
  select email into snapshot_email
  from auth.users
  where id = old.primary_owner_user_id;

  perform public.prepare_account_storage_purge(
    old.id,
    snapshot_email,
    old.name
  );

  return old;
end;
$$;

drop trigger if exists accounts_enqueue_storage_purge on public.accounts;
create trigger accounts_enqueue_storage_purge
  after delete on public.accounts
  for each row
  execute function public.enqueue_account_storage_purge();
