-- Bind Gmail OAuth connections to a workspace (account).
--
-- Before: unique (user_id, mailbox_kind) — one business inbox per user, leaked
-- into every workspace membership (nav badge + dashboard "Needs a reply").
-- After: personal stays user-global; business is unique (user_id, account_id).
-- Existing business rows are attributed to one home workspace only (not copied).

-- ---------------------------------------------------------------------------
-- google_connections.account_id
-- ---------------------------------------------------------------------------
alter table public.google_connections
  add column if not exists account_id uuid references public.accounts (id) on delete cascade;

comment on column public.google_connections.account_id is
  'Workspace that owns this mailbox. Required for business; null for personal.';

create index if not exists ix_google_connections_account_id
  on public.google_connections (account_id)
  where account_id is not null;

-- Prefer the workspace already stamped on synced threads for this connection.
with thread_votes as (
  select
    t.connection_id,
    t.account_id,
    count(*) as n
  from public.email_threads t
  where t.connection_id is not null
    and t.account_id is not null
  group by t.connection_id, t.account_id
),
best_thread_account as (
  select distinct on (connection_id)
    connection_id,
    account_id
  from thread_votes
  order by connection_id, n desc
),
owned_team as (
  select distinct on (a.primary_owner_user_id)
    a.primary_owner_user_id as user_id,
    a.id as account_id
  from public.accounts a
  where a.is_personal_account = false
  order by a.primary_owner_user_id, a.created_at asc nulls last
),
member_team as (
  select distinct on (m.user_id)
    m.user_id,
    m.account_id
  from public.accounts_memberships m
  join public.accounts a on a.id = m.account_id
  where a.is_personal_account = false
  order by m.user_id, m.created_at asc
)
update public.google_connections c
set account_id = coalesce(
  (
    select bta.account_id
    from best_thread_account bta
    where bta.connection_id = c.id
  ),
  (
    select ot.account_id
    from owned_team ot
    where ot.user_id = c.user_id
  ),
  (
    select mt.account_id
    from member_team mt
    where mt.user_id = c.user_id
  ),
  (
    select personal.id
    from public.accounts personal
    where personal.id = c.user_id
      and personal.is_personal_account = true
  )
)
where c.mailbox_kind = 'business'
  and c.account_id is null;

-- Unattributable business rows cannot satisfy the new check; drop them rather
-- than leave a user-global inbox in place.
delete from public.google_connections
where mailbox_kind = 'business'
  and account_id is null;

alter table public.google_connections
  drop constraint if exists google_connections_account_kind_check;

alter table public.google_connections
  add constraint google_connections_account_kind_check
  check (
    (mailbox_kind = 'personal' and account_id is null)
    or
    (mailbox_kind = 'business' and account_id is not null)
  );

alter table public.google_connections
  drop constraint if exists google_connections_user_mailbox_unique;

drop index if exists google_connections_user_mailbox_unique;

create unique index if not exists google_connections_personal_user_uidx
  on public.google_connections (user_id)
  where mailbox_kind = 'personal';

create unique index if not exists google_connections_business_user_account_uidx
  on public.google_connections (user_id, account_id)
  where mailbox_kind = 'business';

-- Stamp unscoped business threads onto the connection's home workspace.
update public.email_threads t
set account_id = c.account_id
from public.google_connections c
where t.connection_id = c.id
  and c.mailbox_kind = 'business'
  and c.account_id is not null
  and t.account_id is null;

-- Cron claim: include account_id so background sync stamps the owning workspace.
drop function if exists public.claim_gmail_sync_batch(integer);

create or replace function public.claim_gmail_sync_batch(
  p_batch_size integer default 8
)
returns table (
  connection_id uuid,
  user_id uuid,
  mailbox_kind text,
  account_id uuid
)
language sql
security definer
set search_path = ''
as $$
  with next_connections as (
    select
      connection.id as connection_id,
      connection.user_id,
      connection.mailbox_kind,
      connection.account_id
    from public.google_connections connection
    left join public.email_assistant_settings settings
      on settings.connection_id = connection.id
    order by settings.last_synced_at asc nulls first,
             connection.updated_at asc nulls first
    for update of connection skip locked
    limit greatest(1, least(coalesce(p_batch_size, 8), 50))
  ),
  claimed as (
    update public.google_connections connection
    set updated_at = now()
    from next_connections
    where connection.id = next_connections.connection_id
    returning
      connection.id as connection_id,
      connection.user_id,
      connection.mailbox_kind,
      connection.account_id
  )
  select
    claimed.connection_id,
    claimed.user_id,
    claimed.mailbox_kind,
    claimed.account_id
  from claimed;
$$;

comment on function public.claim_gmail_sync_batch(integer) is
  'Atomically claims least-recently-synced Gmail connections (business per workspace + personal).';

revoke all on function public.claim_gmail_sync_batch(integer) from public;
grant execute on function public.claim_gmail_sync_batch(integer) to service_role;

notify pgrst, 'reload schema';
