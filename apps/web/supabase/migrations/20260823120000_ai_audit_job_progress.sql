-- Checkpoint progress so AI audits can resume across worker invocations
-- without restarting crawl/citations from scratch (Vercel maxDuration).

alter table rankly.ai_audit_jobs
  add column if not exists progress jsonb;

alter table rankly.ai_audit_jobs
  add column if not exists last_worker_trigger_at timestamptz;

alter table rankly.ai_audit_jobs
  add column if not exists claimed_until timestamptz;

comment on column rankly.ai_audit_jobs.progress is
  'Checkpointed crawl/citation payloads for resumable multi-invocation runs';

comment on column rankly.ai_audit_jobs.last_worker_trigger_at is
  'Last time a /run worker was triggered (debounce concurrent restarts)';

comment on column rankly.ai_audit_jobs.claimed_until is
  'Exclusive worker lease; cleared when a slice yields so continuation can claim';
