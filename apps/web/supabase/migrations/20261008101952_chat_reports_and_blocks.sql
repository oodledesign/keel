/*
 * -------------------------------------------------------
 * Chat safety: per-user blocks and message reports (App Store Guideline 1.2)
 * Blocks are personal: a blocked user's messages are hidden from the blocker
 * and the blocker gets no notifications from them. Reports are reviewed by Ozer.
 * -------------------------------------------------------
 */

create table if not exists public.chat_user_blocks (
  blocker_user_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint chat_user_blocks_not_self check (blocker_user_id <> blocked_user_id)
);

comment on table public.chat_user_blocks is
  'Users a person has blocked in Messages. Hides their messages and notifications for the blocker only.';

create index if not exists idx_chat_user_blocks_blocked
  on public.chat_user_blocks (blocked_user_id);

alter table public.chat_user_blocks enable row level security;
revoke all on public.chat_user_blocks from anon, authenticated, service_role;
grant select, insert, delete on table public.chat_user_blocks to authenticated;
grant select, insert, update, delete on table public.chat_user_blocks to service_role;

create policy chat_user_blocks_select_own on public.chat_user_blocks
  for select to authenticated
  using (blocker_user_id = (select auth.uid()));

create policy chat_user_blocks_insert_own on public.chat_user_blocks
  for insert to authenticated
  with check (blocker_user_id = (select auth.uid()));

create policy chat_user_blocks_delete_own on public.chat_user_blocks
  for delete to authenticated
  using (blocker_user_id = (select auth.uid()));

create table if not exists public.chat_message_reports (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  thread_id uuid references public.chat_threads (id) on delete set null,
  message_id uuid references public.chat_messages (id) on delete set null,
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  reason text not null check (
    reason in ('spam', 'harassment', 'inappropriate', 'other')
  ),
  details text check (char_length(details) <= 2000),
  -- Snapshot so the report survives the message being edited or deleted.
  message_body text,
  status text not null default 'open' check (
    status in ('open', 'actioned', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.chat_message_reports is
  'Reports of objectionable chat messages or conversations, for Ozer to review.';

create index if not exists idx_chat_message_reports_open
  on public.chat_message_reports (created_at desc)
  where status = 'open';

alter table public.chat_message_reports enable row level security;
revoke all on public.chat_message_reports from anon, authenticated, service_role;
-- Inserts go through the server, which first checks the reporter is in the thread.
grant select on table public.chat_message_reports to authenticated;
grant select, insert, update, delete on table public.chat_message_reports to service_role;

create policy chat_message_reports_select_own on public.chat_message_reports
  for select to authenticated
  using (reporter_user_id = (select auth.uid()));
