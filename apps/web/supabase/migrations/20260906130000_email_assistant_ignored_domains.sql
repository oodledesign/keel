-- Per-mailbox domain ignores for email task extraction / triage.
alter table public.email_assistant_settings
  add column if not exists ignored_domains text[] not null default '{}'::text[];

comment on column public.email_assistant_settings.ignored_domains is
  'Lowercased email domains excluded from auto-triage, drafts, and task extraction.';
