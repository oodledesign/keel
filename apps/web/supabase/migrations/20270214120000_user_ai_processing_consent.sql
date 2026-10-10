-- Whether a user lets Ozer send their content to third-party AI providers
-- (Anthropic, Google Gemini, Voyage AI). NULL means they haven't been asked;
-- the iOS app asks before first use. 'denied' stops automatic summaries,
-- suggested tasks, survey clean-up and search indexing of their content.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS ai_processing_consent text,
  ADD COLUMN IF NOT EXISTS ai_processing_consent_at timestamptz;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_ai_processing_consent_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_ai_processing_consent_check
  CHECK (
    ai_processing_consent IS NULL
    OR ai_processing_consent IN ('granted', 'denied')
  );

CREATE INDEX IF NOT EXISTS ix_user_settings_ai_processing_denied
  ON public.user_settings (user_id)
  WHERE ai_processing_consent = 'denied';

-- 'skipped': the author declined AI processing, so no summary or suggested
-- tasks are generated and the post-sync worker never picks the row up.
ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_summary_status_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_summary_status_check
  CHECK (
    summary_status IN ('idle', 'pending', 'processing', 'ready', 'failed', 'skipped')
  );

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_task_extraction_status_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_task_extraction_status_check
  CHECK (
    task_extraction_status IN ('idle', 'pending', 'processing', 'ready', 'failed', 'skipped')
  );
