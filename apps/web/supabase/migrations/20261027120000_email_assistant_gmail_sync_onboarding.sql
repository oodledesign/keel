-- Gmail auto-file settings + email onboarding completion

alter table public.email_assistant_settings
  add column if not exists sync_triage_to_gmail boolean not null default false,
  add column if not exists respect_existing_gmail_labels boolean not null default true,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.email_assistant_settings.sync_triage_to_gmail is
  'When true, auto-triage and reply reconciliation write Ozer/* labels (and archive rules) to Gmail.';

comment on column public.email_assistant_settings.respect_existing_gmail_labels is
  'When true, skip auto Gmail writeback if the thread already has a non-Ozer user label.';

comment on column public.email_assistant_settings.onboarding_completed_at is
  'Set when the user finishes or skips the email onboarding wizard for this connection.';
