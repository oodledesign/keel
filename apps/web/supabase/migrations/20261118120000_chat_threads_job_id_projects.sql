-- chat_threads.job_id was added when messaging lived on public.jobs.
-- Ozer delivery work is public.projects (the Messages tab already passes
-- project IDs via ?threadJob=). Point the FK at projects so create-chat
-- no longer fails with a foreign-key violation / Next.js digest.

ALTER TABLE public.chat_threads
  DROP CONSTRAINT IF EXISTS chat_threads_job_id_fkey;

UPDATE public.chat_threads t
SET job_id = NULL
WHERE t.job_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = t.job_id
  );

ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.projects (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.chat_threads.job_id IS
  'Linked Ozer project (delivery/campaign). Column name is historical.';
