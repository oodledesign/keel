-- Store per-platform AI citation breakdown (Google, ChatGPT, Perplexity, Claude)

alter table rankly.ai_audit_reports
  add column if not exists ai_citations_by_platform jsonb;

notify pgrst, 'reload schema';
