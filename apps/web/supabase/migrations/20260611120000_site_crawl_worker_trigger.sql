alter table rankly.site_crawl_jobs
  add column if not exists last_worker_trigger_at timestamptz;

notify pgrst, 'reload schema';
