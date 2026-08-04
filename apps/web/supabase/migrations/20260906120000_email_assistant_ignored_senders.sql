-- Persist per-mailbox sender ignores for email task extraction / triage.
alter table public.email_assistant_settings
  add column if not exists ignored_senders text[] not null default '{}'::text[];

comment on column public.email_assistant_settings.ignored_senders is
  'Lowercased email addresses excluded from auto-triage, drafts, and task extraction.';
