alter table public.email_assistant_settings
  add column if not exists signature_is_html boolean not null default false;
