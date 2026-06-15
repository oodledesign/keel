-- Auto-triage categories on threads + assistant automation settings

alter table public.email_threads
  add column if not exists assistant_category text,
  add column if not exists assistant_category_reason text,
  add column if not exists assistant_processed_message_id uuid references public.email_messages(id) on delete set null;

alter table public.email_assistant_settings
  add column if not exists auto_triage_enabled boolean not null default true,
  add column if not exists auto_draft_enabled boolean not null default true,
  add column if not exists auto_save_gmail_drafts boolean not null default false;

create index if not exists idx_email_threads_user_category
  on public.email_threads (user_id, assistant_category, last_message_at desc);
