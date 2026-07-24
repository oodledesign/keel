-- Dual Gmail mailboxes per user: business (default, migrated) + personal.

-- ---------------------------------------------------------------------------
-- google_connections: id PK + mailbox_kind
-- ---------------------------------------------------------------------------
alter table public.google_connections
  add column if not exists id uuid,
  add column if not exists mailbox_kind text;

update public.google_connections
set id = gen_random_uuid()
where id is null;

update public.google_connections
set mailbox_kind = 'business'
where mailbox_kind is null;

alter table public.google_connections
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column mailbox_kind set default 'business',
  alter column mailbox_kind set not null;

alter table public.google_connections
  drop constraint if exists google_connections_pkey;

alter table public.google_connections
  add primary key (id);

alter table public.google_connections
  drop constraint if exists google_connections_mailbox_kind_check;

alter table public.google_connections
  add constraint google_connections_mailbox_kind_check
  check (mailbox_kind in ('business', 'personal'));

alter table public.google_connections
  drop constraint if exists google_connections_user_mailbox_unique;

alter table public.google_connections
  add constraint google_connections_user_mailbox_unique
  unique (user_id, mailbox_kind);

create index if not exists ix_google_connections_user_id
  on public.google_connections (user_id);

comment on column public.google_connections.mailbox_kind is
  'business = workspace email assistant; personal = personal-shell inbox';

-- ---------------------------------------------------------------------------
-- email_assistant_settings: PK = connection_id
-- ---------------------------------------------------------------------------
alter table public.email_assistant_settings
  add column if not exists connection_id uuid;

update public.email_assistant_settings s
set connection_id = c.id
from public.google_connections c
where c.user_id = s.user_id
  and c.mailbox_kind = 'business'
  and s.connection_id is null;

delete from public.email_assistant_settings
where connection_id is null;

alter table public.email_assistant_settings
  alter column connection_id set not null;

alter table public.email_assistant_settings
  drop constraint if exists email_assistant_settings_pkey;

alter table public.email_assistant_settings
  add primary key (connection_id);

alter table public.email_assistant_settings
  drop constraint if exists email_assistant_settings_connection_id_fkey;

alter table public.email_assistant_settings
  add constraint email_assistant_settings_connection_id_fkey
  foreign key (connection_id)
  references public.google_connections (id)
  on delete cascade;

create index if not exists ix_email_assistant_settings_user_id
  on public.email_assistant_settings (user_id);

-- ---------------------------------------------------------------------------
-- email_threads / email_messages: connection_id
-- ---------------------------------------------------------------------------
alter table public.email_threads
  add column if not exists connection_id uuid;

update public.email_threads t
set connection_id = c.id
from public.google_connections c
where c.user_id = t.user_id
  and c.mailbox_kind = 'business'
  and t.connection_id is null;

alter table public.email_threads
  drop constraint if exists email_threads_user_id_gmail_thread_id_key;

alter table public.email_threads
  drop constraint if exists email_threads_connection_gmail_unique;

alter table public.email_threads
  add constraint email_threads_connection_gmail_unique
  unique (connection_id, gmail_thread_id);

alter table public.email_threads
  drop constraint if exists email_threads_connection_id_fkey;

alter table public.email_threads
  add constraint email_threads_connection_id_fkey
  foreign key (connection_id)
  references public.google_connections (id)
  on delete cascade;

create index if not exists ix_email_threads_connection_last
  on public.email_threads (connection_id, last_message_at desc nulls last);

alter table public.email_messages
  add column if not exists connection_id uuid;

update public.email_messages m
set connection_id = t.connection_id
from public.email_threads t
where t.id = m.thread_id
  and m.connection_id is null;

alter table public.email_messages
  drop constraint if exists email_messages_user_id_gmail_message_id_key;

alter table public.email_messages
  drop constraint if exists email_messages_connection_gmail_unique;

alter table public.email_messages
  add constraint email_messages_connection_gmail_unique
  unique (connection_id, gmail_message_id);

alter table public.email_messages
  drop constraint if exists email_messages_connection_id_fkey;

alter table public.email_messages
  add constraint email_messages_connection_id_fkey
  foreign key (connection_id)
  references public.google_connections (id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- Cron claim: one row per connection (business + personal)
-- ---------------------------------------------------------------------------
create or replace function public.claim_gmail_sync_batch(
  p_batch_size integer default 8
)
returns table (
  connection_id uuid,
  user_id uuid,
  mailbox_kind text
)
language sql
security definer
set search_path = ''
as $$
  with next_connections as (
    select
      connection.id as connection_id,
      connection.user_id,
      connection.mailbox_kind
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
      connection.mailbox_kind
  )
  select claimed.connection_id, claimed.user_id, claimed.mailbox_kind
  from claimed;
$$;

comment on function public.claim_gmail_sync_batch(integer) is
  'Atomically claims least-recently-synced Gmail connections (business + personal).';

notify pgrst, 'reload schema';
