-- Open PageRank scores on AI audit reports and content brief competitor domains

alter table rankly.ai_audit_reports
  add column if not exists opr_score int,
  add column if not exists opr_decimal numeric(4, 2),
  add column if not exists ai_competing_brands_opr jsonb;

alter table rankly.content_briefs
  add column if not exists competitor_domains jsonb;

comment on column rankly.ai_audit_reports.opr_score is
  'Open PageRank integer score (0–10) for target domain at audit time.';
comment on column rankly.ai_audit_reports.ai_competing_brands_opr is
  'Competing brands cited in AI search with OPR scores at audit time.';

notify pgrst, 'reload schema';
