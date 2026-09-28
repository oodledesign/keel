-- Store rendered HTML for outbound platform emails so admins can preview
-- circulation and other sends from the email log.

alter table public.platform_email_log
  add column if not exists html_body text;

comment on column public.platform_email_log.html_body is
  'Rendered HTML body for staff preview (nullable for older rows)';
