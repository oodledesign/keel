-- Additive: link quality promotions back to their draft job.
ALTER TABLE public.media_generation_jobs
  ADD COLUMN IF NOT EXISTS promoted_from_job_id uuid
  REFERENCES public.media_generation_jobs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_media_generation_jobs_promoted_from
  ON public.media_generation_jobs (promoted_from_job_id)
  WHERE promoted_from_job_id IS NOT NULL;

COMMENT ON COLUMN public.media_generation_jobs.promoted_from_job_id IS
  'When set, this job is a quality promotion of the referenced draft job.';
