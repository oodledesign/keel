/** Tasks processed per worker invocation (one Vercel function call). */
export const RANK_TASKS_PER_INVOCATION = 20;

/** Minimum seconds between chained worker triggers for the same job. */
export const RANK_WORKER_TRIGGER_DEBOUNCE_SEC = 45;

/** Max rank-check jobs the sweeper cron starts per tick. */
export const RANK_GLOBAL_MAX_ACTIVE_JOBS = 5;

/** UI poll interval while a job is running. */
export const RANK_JOB_POLL_INTERVAL_MS = 8_000;

/** Stale processing tasks reset to pending after this many minutes. */
export const RANK_TASK_STALE_MINUTES = 10;

/** Mark job failed if no task progress for this many minutes. */
export const RANK_JOB_STALE_MINUTES = 45;
