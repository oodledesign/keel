/** UI poll interval while a site crawl job is running. */
export const SITE_CRAWL_POLL_INTERVAL_MS = 8_000;

/** Minimum seconds between chained worker triggers for the same job. */
export const SITE_CRAWL_WORKER_TRIGGER_DEBOUNCE_SEC = 15;

/** Max site-crawl jobs the sweeper cron starts per tick. */
export const SITE_CRAWL_MAX_ACTIVE_JOBS = 8;

/** Resume jobs with no progress for at least this many minutes. */
export const SITE_CRAWL_WORKER_STALL_MINUTES = 3;

/** Mark job failed if pending URLs remain with no progress for this long. */
export const SITE_CRAWL_JOB_STALE_MINUTES = 120;
