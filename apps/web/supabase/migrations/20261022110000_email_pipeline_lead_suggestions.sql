-- Email assistant: suggested pipeline leads from inbound enquiries

alter table public.email_threads
  add column if not exists pipeline_lead_suggestion jsonb,
  add column if not exists pipeline_lead_confidence numeric(4, 3),
  add column if not exists pipeline_deal_id uuid references public.pipeline_deals (id) on delete set null;

comment on column public.email_threads.pipeline_lead_suggestion is
  'Suggested pipeline lead fields when thread looks like a new business enquiry.';
comment on column public.email_threads.pipeline_lead_confidence is
  '0-1 confidence for pipeline lead suggestion.';
comment on column public.email_threads.pipeline_deal_id is
  'Set when user accepts a suggested lead and a pipeline_deals row is created.';

alter table public.pipeline_deals
  add column if not exists email_thread_id uuid references public.email_threads (id) on delete set null;

create unique index if not exists ux_pipeline_deals_email_thread_id
  on public.pipeline_deals (email_thread_id)
  where email_thread_id is not null;

comment on column public.pipeline_deals.email_thread_id is
  'Source email thread when this deal was created from the email assistant.';
