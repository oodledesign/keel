-- Track summary + suggested-task extraction after an Assistant transcript sync.
-- The sync response returns before the model calls finish, so status has to
-- live on the meeting row (the in-request promise was not durable).

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS summary_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS task_extraction_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS post_sync_error text,
  ADD COLUMN IF NOT EXISTS post_sync_updated_at timestamptz;

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_summary_status_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_summary_status_check
  CHECK (summary_status IN ('idle', 'pending', 'processing', 'ready', 'failed'));

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_task_extraction_status_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_task_extraction_status_check
  CHECK (
    task_extraction_status IN ('idle', 'pending', 'processing', 'ready', 'failed')
  );

COMMENT ON COLUMN public.meeting_transcripts.summary_status IS
  'AI summary pipeline: idle, pending, processing, ready, or failed.';

COMMENT ON COLUMN public.meeting_transcripts.task_extraction_status IS
  'Suggested-task extraction: idle, pending, processing, ready, or failed.';

COMMENT ON COLUMN public.meeting_transcripts.post_sync_error IS
  'Last summary or task-extraction error shown on the meeting page.';

CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_post_sync_open
  ON public.meeting_transcripts (post_sync_updated_at)
  WHERE summary_status IN ('pending', 'processing')
     OR task_extraction_status IN ('pending', 'processing');

-- Status is written only by the service-role post-sync worker.
REVOKE UPDATE (
  summary_status,
  task_extraction_status,
  post_sync_error,
  post_sync_updated_at
) ON public.meeting_transcripts FROM authenticated;

-- Recent Assistant syncs that saved a transcript and never produced a summary.
-- Includes Dan’s oodle-design reproduction meeting regardless of age.
UPDATE public.meeting_transcripts AS mt
SET
  summary_status = 'pending',
  task_extraction_status = 'pending',
  post_sync_error = NULL,
  post_sync_updated_at = now()
WHERE mt.proposal_id IS NULL
  AND btrim(mt.content) <> ''
  AND mt.summary_status = 'idle'
  AND mt.task_extraction_status = 'idle'
  AND NOT EXISTS (
    SELECT 1
    FROM public.meeting_summaries AS ms
    WHERE ms.meeting_transcript_id = mt.id
  )
  AND (
    mt.id = 'ae299629-d90a-4508-91cd-7b11f771de3e'
    OR (
      mt.source = 'desktop_recorder'
      AND mt.created_at > now() - interval '14 days'
    )
  );

-- Summary row exists but statuses never left idle (partial floating-promise run).
UPDATE public.meeting_transcripts AS mt
SET
  summary_status = 'ready',
  task_extraction_status = 'pending',
  post_sync_error = NULL,
  post_sync_updated_at = now()
WHERE mt.proposal_id IS NULL
  AND btrim(mt.content) <> ''
  AND mt.summary_status = 'idle'
  AND mt.task_extraction_status = 'idle'
  AND EXISTS (
    SELECT 1
    FROM public.meeting_summaries AS ms
    WHERE ms.meeting_transcript_id = mt.id
      AND btrim(ms.summary_text) <> ''
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.meeting_action_items AS mai
    WHERE mai.meeting_transcript_id = mt.id
  )
  AND (
    mt.id = 'ae299629-d90a-4508-91cd-7b11f771de3e'
    OR (
      mt.source = 'desktop_recorder'
      AND mt.created_at > now() - interval '14 days'
    )
  );

-- Summary ready in status terms but tasks still idle (post-column partial runs).
UPDATE public.meeting_transcripts AS mt
SET
  task_extraction_status = 'pending',
  post_sync_error = NULL,
  post_sync_updated_at = now()
WHERE mt.proposal_id IS NULL
  AND btrim(mt.content) <> ''
  AND mt.summary_status = 'ready'
  AND mt.task_extraction_status = 'idle'
  AND NOT EXISTS (
    SELECT 1
    FROM public.meeting_action_items AS mai
    WHERE mai.meeting_transcript_id = mt.id
  )
  AND (
    mt.id = 'ae299629-d90a-4508-91cd-7b11f771de3e'
    OR (
      mt.source = 'desktop_recorder'
      AND mt.created_at > now() - interval '14 days'
    )
  );
