-- Common Crawl backlink data for content briefs and AI audit reports

alter table rankly.content_briefs
  add column if not exists target_referring_domains int,
  add column if not exists competitor_backlinks jsonb;

alter table rankly.ai_audit_reports
  add column if not exists referring_domains int,
  add column if not exists top_referring_domains jsonb,
  add column if not exists competitor_backlinks jsonb;

comment on column rankly.content_briefs.target_referring_domains is
  'Referring domain count for target domain (Common Crawl link graph snapshot)';
comment on column rankly.content_briefs.competitor_backlinks is
  'Map of competitor domain → referring domain count from Common Crawl';
comment on column rankly.ai_audit_reports.referring_domains is
  'Target domain referring domain count from Common Crawl';
comment on column rankly.ai_audit_reports.top_referring_domains is
  'Top referring domains with link counts (Common Crawl snapshot)';
comment on column rankly.ai_audit_reports.competitor_backlinks is
  'Map of competing brand domain → referring domain count';
