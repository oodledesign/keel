-- Backfill workspace scope for project/job board tasks created before account_id was set.

UPDATE public.tasks t
SET account_id = j.account_id
FROM public.jobs j
WHERE t.job_id = j.id
  AND t.account_id IS DISTINCT FROM j.account_id;

NOTIFY pgrst, 'reload schema';
