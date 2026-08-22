-- Email assistant: multi-category triage, link suggestions, follow-ups, send opt-in

-- Backfill legacy binary categories before adding CHECK constraint
update public.email_threads
set assistant_category = 'reply_now'
where assistant_category = 'needs_reply';

update public.email_threads
set assistant_category = 'noise'
where assistant_category = 'no_reply';

alter table public.email_threads
  drop constraint if exists email_threads_assistant_category_check;

alter table public.email_threads
  add constraint email_threads_assistant_category_check
  check (
    assistant_category is null
    or assistant_category in (
      'reply_now',
      'reply_later',
      'waiting',
      'fyi',
      'noise'
    )
  );

alter table public.email_threads
  add column if not exists assistant_category_confidence numeric(4, 3),
  add column if not exists link_confidence numeric(4, 3),
  add column if not exists link_suggestion jsonb,
  add column if not exists follow_up_at timestamptz,
  add column if not exists follow_up_note text;

create index if not exists idx_email_threads_user_follow_up
  on public.email_threads (user_id, follow_up_at)
  where follow_up_at is not null;

comment on column public.email_threads.assistant_category_confidence is
  '0-1 confidence from AI triage classification.';
comment on column public.email_threads.link_confidence is
  '0-1 confidence for suggested CRM link when not auto-applied.';
comment on column public.email_threads.link_suggestion is
  'Suggested account_id, client_id, project_id when link_confidence is below auto-apply threshold.';

alter table public.email_assistant_settings
  add column if not exists allow_send_from_ozer boolean not null default false;

comment on column public.email_assistant_settings.allow_send_from_ozer is
  'When true, user may send Gmail replies from Ozer (manual confirmation required).';

alter table public.email_drafts
  add column if not exists gmail_message_id text,
  add column if not exists sent_at timestamptz;
