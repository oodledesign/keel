-- Snapshot owner email/name so we can warn before the 30-day storage wipe.
-- Personal-account delete removes auth.users first, so the app also calls
-- prepare_account_storage_purge() with the email before deleteUser.

alter table public.account_storage_purges
  add column if not exists owner_email text,
  add column if not exists account_name text,
  add column if not exists notice_14d_sent_at timestamptz,
  add column if not exists notice_3d_sent_at timestamptz;

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
