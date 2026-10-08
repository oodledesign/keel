/*
 * -------------------------------------------------------
 * Section: Account deletion guardrails
 * User rows (auth.users and personal accounts) are never deleted, so nothing
 * that references a user id breaks. Deleting an account schedules it, locks
 * sign-in for a grace period, then wipes the person's data and anonymises the
 * user row in place.
 * -------------------------------------------------------
 */

create table if not exists public.protected_users (
  user_id uuid primary key references auth.users (id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now()
);

comment on table public.protected_users is
  'Users whose accounts can never be scheduled for deletion. Super admins are always protected.';

alter table public.protected_users enable row level security;

revoke all on public.protected_users from authenticated, service_role;
grant select, insert, update, delete on public.protected_users to service_role;
grant select on public.protected_users to authenticated;

create policy protected_users_super_admin_read
  on public.protected_users
  for select to authenticated
  using (public.is_super_admin());

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  source text not null check (source in ('ios', 'web', 'admin')),
  requested_by uuid references auth.users (id) on delete restrict,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  cancelled_at timestamptz,
  completed_at timestamptz,
  contact_email text,
  email_sha256 text,
  personal_account_name text,
  deleted_team_account_ids uuid[] not null default '{}',
  left_team_account_ids uuid[] not null default '{}',
  rows_affected integer,
  error text
);

comment on table public.account_deletions is
  'Audit log and schedule for account deletions. Rows are kept forever; contact_email is cleared when the deletion completes.';

create unique index if not exists account_deletions_one_open_per_user
  on public.account_deletions (user_id)
  where status in ('scheduled', 'failed');

create index if not exists account_deletions_due_idx
  on public.account_deletions (scheduled_for)
  where status in ('scheduled', 'failed');

alter table public.account_deletions enable row level security;

revoke all on public.account_deletions from authenticated, service_role;
grant select, insert, update on public.account_deletions to service_role;
grant select on public.account_deletions to authenticated;

create policy account_deletions_super_admin_read
  on public.account_deletions
  for select to authenticated
  using (public.is_super_admin());

/*
 * Emergency override: `set local app.allow_user_row_delete = 'on';` inside a
 * transaction. Users created in the last 15 minutes who never signed in can be
 * rolled back (admin workspace provisioning relies on this).
 */
create or replace function public.prevent_user_row_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.allow_user_row_delete', true), '') = 'on' then
    return old;
  end if;

  if old.last_sign_in_at is null
     and old.created_at > now() - interval '15 minutes' then
    return old;
  end if;

  raise exception 'User rows are never deleted. Schedule an account deletion instead.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists auth_users_prevent_delete on auth.users;
create trigger auth_users_prevent_delete
  before delete on auth.users
  for each row
  execute function public.prevent_user_row_delete();

create or replace function public.prevent_personal_account_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not old.is_personal_account then
    return old;
  end if;

  if coalesce(current_setting('app.allow_user_row_delete', true), '') = 'on' then
    return old;
  end if;

  -- Cascade from an allowed auth.users delete (the owner row is already gone).
  if not exists (
    select 1 from auth.users where id = old.primary_owner_user_id
  ) then
    return old;
  end if;

  raise exception 'Personal accounts are never deleted. Schedule an account deletion instead.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists accounts_prevent_personal_delete on public.accounts;
create trigger accounts_prevent_personal_delete
  before delete on public.accounts
  for each row
  execute function public.prevent_personal_account_delete();

create or replace function public.is_user_deletion_protected(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.protected_users where user_id = target_user_id
  ) or exists (
    select 1 from auth.users
    where id = target_user_id
      and raw_app_meta_data ->> 'role' = 'super-admin'
  );
$$;

create or replace function public.schedule_account_deletion(
  target_user_id uuid,
  target_source text,
  target_requested_by uuid,
  target_contact_email text,
  grace_period interval default interval '30 days'
)
returns public.account_deletions
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion public.account_deletions;
  normalized_email text := nullif(lower(trim(target_contact_email)), '');
begin
  if public.is_user_deletion_protected(target_user_id) then
    raise exception 'This account is protected and cannot be deleted'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.account_deletions
    where user_id = target_user_id and status in ('scheduled', 'failed')
  ) then
    raise exception 'This account is already scheduled for deletion'
      using errcode = 'P0001';
  end if;

  insert into public.account_deletions (
    user_id,
    source,
    requested_by,
    scheduled_for,
    contact_email,
    email_sha256,
    personal_account_name
  )
  values (
    target_user_id,
    target_source,
    target_requested_by,
    now() + grace_period,
    normalized_email,
    case
      when normalized_email is null then null
      else encode(sha256(convert_to(normalized_email, 'UTF8')), 'hex')
    end,
    (
      select name from public.accounts
      where id = target_user_id and is_personal_account
    )
  )
  returning * into deletion;

  update auth.users set banned_until = 'infinity' where id = target_user_id;
  delete from auth.sessions where user_id = target_user_id;
  delete from auth.refresh_tokens where user_id = target_user_id::text;

  return deletion;
end;
$$;

create or replace function public.restore_account_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_deletions
  set status = 'cancelled', cancelled_at = now()
  where user_id = target_user_id and status in ('scheduled', 'failed');

  if not found then
    raise exception 'No scheduled deletion for this user' using errcode = 'P0002';
  end if;

  update auth.users set banned_until = null where id = target_user_id;
end;
$$;

/*
 * Runs in one transaction: either everything is wiped or nothing is.
 * Workspace data follows each foreign key's own on-delete rule, exactly as if
 * the user had been deleted, except the user row and personal account survive.
 * Rows in team workspaces that only reference the user (authored tasks,
 * messages) are kept and keep pointing at the anonymised user row.
 */
create or replace function public.complete_account_deletion(target_deletion_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion public.account_deletions;
  target uuid;
  solo_teams uuid[];
  left_teams uuid[];
  fk record;
  affected integer := 0;
  changed integer;
  failures integer;
  last_error text;
begin
  select * into deletion
  from public.account_deletions
  where id = target_deletion_id
  for update;

  if not found or deletion.status not in ('scheduled', 'failed') then
    raise exception 'Deletion % is not open', target_deletion_id;
  end if;

  if deletion.scheduled_for > now() then
    raise exception 'Grace period for deletion % has not ended', target_deletion_id;
  end if;

  target := deletion.user_id;

  if public.is_user_deletion_protected(target) then
    raise exception 'User % is protected', target;
  end if;

  if exists (
    select 1
    from public.accounts a
    where a.primary_owner_user_id = target
      and not a.is_personal_account
      and exists (
        select 1 from public.accounts_memberships m
        where m.account_id = a.id and m.user_id <> target
      )
  ) then
    raise exception 'User % still owns a workspace with other members', target;
  end if;

  select coalesce(array_agg(id), '{}') into solo_teams
  from public.accounts
  where primary_owner_user_id = target and not is_personal_account;

  select coalesce(array_agg(account_id), '{}') into left_teams
  from public.accounts_memberships
  where user_id = target
    and account_id <> target
    and account_id <> all (solo_teams);

  delete from public.accounts_memberships
  where user_id = target and account_id = any (left_teams);
  get diagnostics changed = row_count;
  affected := affected + changed;

  delete from public.accounts where id = any (solo_teams);
  get diagnostics changed = row_count;
  affected := affected + changed;

  -- Several passes so child rows clear before parents that restrict them.
  for pass in 1..6 loop
    failures := 0;

    for fk in
      select
        c.conrelid::regclass as tbl,
        a.attname as col,
        c.confdeltype as rule
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where c.contype = 'f'
        and array_length(c.conkey, 1) = 1
        and ns.nspname not in ('auth', 'storage')
        and c.conrelid not in (
          'public.accounts'::regclass,
          'public.account_deletions'::regclass,
          'public.protected_users'::regclass
        )
        and (
          (
            c.confrelid = 'public.accounts'::regclass
            and c.confdeltype in ('c', 'n', 'd')
          )
          or (
            -- User-scoped tables only; workspace content is kept.
            c.confrelid = 'auth.users'::regclass
            and c.confdeltype = 'c'
            and not exists (
              select 1 from pg_constraint c2
              where c2.conrelid = c.conrelid
                and c2.contype = 'f'
                and c2.confrelid = 'public.accounts'::regclass
            )
          )
        )
    loop
      begin
        if fk.rule = 'c' then
          execute format('delete from %s where %I = $1', fk.tbl, fk.col)
            using target;
        elsif fk.rule = 'n' then
          execute format('update %s set %I = null where %I = $1', fk.tbl, fk.col, fk.col)
            using target;
        else
          execute format('update %s set %I = default where %I = $1', fk.tbl, fk.col, fk.col)
            using target;
        end if;

        get diagnostics changed = row_count;
        affected := affected + changed;
      exception
        when foreign_key_violation or restrict_violation then
          failures := failures + 1;
          last_error := sqlerrm;
      end;
    end loop;

    exit when failures = 0;
  end loop;

  if failures > 0 then
    raise exception 'Could not remove all data for user %: %', target, last_error;
  end if;

  update auth.users
  set
    email = 'deleted+' || target::text || '@deleted.invalid',
    phone = null,
    encrypted_password = '',
    raw_user_meta_data = '{}'::jsonb,
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'deleted_at', now()
    ),
    banned_until = 'infinity',
    updated_at = now()
  where id = target;

  delete from auth.identities where user_id = target;
  delete from auth.mfa_factors where user_id = target;
  delete from auth.sessions where user_id = target;
  delete from auth.refresh_tokens where user_id = target::text;

  update public.accounts
  set name = 'Deleted user', email = null, picture_url = null, public_data = '{}'::jsonb
  where id = target and is_personal_account;

  perform public.prepare_account_storage_purge(
    target,
    deletion.contact_email,
    deletion.personal_account_name
  );

  update public.account_deletions
  set
    status = 'completed',
    completed_at = now(),
    contact_email = null,
    deleted_team_account_ids = solo_teams,
    left_team_account_ids = left_teams,
    rows_affected = affected,
    error = null
  where id = target_deletion_id;

  return affected;
end;
$$;

revoke all on function public.prevent_user_row_delete() from public, authenticated;
revoke all on function public.prevent_personal_account_delete() from public, authenticated;
revoke all on function public.is_user_deletion_protected(uuid) from public, authenticated;
revoke all on function public.schedule_account_deletion(uuid, text, uuid, text, interval) from public, authenticated;
revoke all on function public.restore_account_deletion(uuid) from public, authenticated;
revoke all on function public.complete_account_deletion(uuid) from public, authenticated;

grant execute on function public.is_user_deletion_protected(uuid) to service_role;
grant execute on function public.schedule_account_deletion(uuid, text, uuid, text, interval) to service_role;
grant execute on function public.restore_account_deletion(uuid) to service_role;
grant execute on function public.complete_account_deletion(uuid) to service_role;
