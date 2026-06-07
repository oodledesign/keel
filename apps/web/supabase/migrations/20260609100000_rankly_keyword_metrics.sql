-- Keyword intent + metrics refresh timestamp for rank tracking insights
alter table rankly.keywords add column if not exists intent text;
alter table rankly.keywords add column if not exists metrics_updated_at timestamptz;

alter table rankly.keywords drop constraint if exists rankly_keywords_intent_check;
alter table rankly.keywords add constraint rankly_keywords_intent_check check (
  intent is null
  or intent in ('informational', 'commercial', 'transactional', 'navigational')
);
