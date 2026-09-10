-- Chrome extension Meet speaker stamps (cloud buffer when local Assistant is offline).

create table if not exists public.extension_speaker_events (
  id uuid unique not null default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete cascade not null,
  user_id uuid references auth.users (id) on delete cascade not null,
  session_id text not null,
  meet_url text,
  meet_code text,
  name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  source text not null,
  confidence text not null,
  created_at timestamptz not null default now(),
  primary key (id),
  constraint extension_speaker_events_source_check
    check (source in ('active_speaker', 'tile', 'caption', 'unknown')),
  constraint extension_speaker_events_confidence_check
    check (confidence in ('high', 'medium', 'low'))
);

create index if not exists ix_extension_speaker_events_session
  on public.extension_speaker_events (user_id, session_id, started_at);

create index if not exists ix_extension_speaker_events_account
  on public.extension_speaker_events (account_id, created_at desc);

comment on table public.extension_speaker_events is
  'Timed Google Meet speaker observations from the Ozer Chrome extension. Live stamps belong on local Assistant; this table is the cloud buffer / pull path.';

alter table public.extension_speaker_events enable row level security;

revoke all on public.extension_speaker_events from authenticated, service_role;
grant select, insert, delete on table public.extension_speaker_events to authenticated, service_role;

drop policy if exists extension_speaker_events_select on public.extension_speaker_events;
create policy extension_speaker_events_select
  on public.extension_speaker_events
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role_on_account(account_id)
  );

drop policy if exists extension_speaker_events_insert on public.extension_speaker_events;
create policy extension_speaker_events_insert
  on public.extension_speaker_events
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_role_on_account(account_id)
  );

drop policy if exists extension_speaker_events_delete on public.extension_speaker_events;
create policy extension_speaker_events_delete
  on public.extension_speaker_events
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role_on_account(account_id)
  );
