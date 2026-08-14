-- Priority (always needs reply) and subject keyword triage rules.
alter table public.email_assistant_settings
  add column if not exists priority_senders text[] not null default '{}'::text[],
  add column if not exists priority_domains text[] not null default '{}'::text[],
  add column if not exists ignored_subject_keywords text[] not null default '{}'::text[],
  add column if not exists priority_subject_keywords text[] not null default '{}'::text[];

comment on column public.email_assistant_settings.priority_senders is
  'Lowercased sender emails that should always be classified as needs_reply.';

comment on column public.email_assistant_settings.priority_domains is
  'Lowercased email domains that should always be classified as needs_reply.';

comment on column public.email_assistant_settings.ignored_subject_keywords is
  'Case-insensitive subject substrings that force no_reply classification.';

comment on column public.email_assistant_settings.priority_subject_keywords is
  'Case-insensitive subject substrings that force needs_reply classification.';
