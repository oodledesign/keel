-- Survey Workspace v2 steps 2–4: keep raw dictation beside the cleaned
-- observation body. Building-surveyor / proposals.kind = survey_report only.
-- Additive. Does not change work / commercial-property / personal / family /
-- community. Transcripts stay the source of truth on meeting_transcripts.content.

ALTER TABLE public.survey_observations
  ADD COLUMN IF NOT EXISTS source_body text;

ALTER TABLE public.survey_observations
  ADD COLUMN IF NOT EXISTS cleanup_source text;

ALTER TABLE public.survey_observations
  DROP CONSTRAINT IF EXISTS survey_observations_cleanup_source_check;

ALTER TABLE public.survey_observations
  ADD CONSTRAINT survey_observations_cleanup_source_check
  CHECK (
    cleanup_source IS NULL
    OR cleanup_source IN ('ai', 'passthrough')
  );

COMMENT ON COLUMN public.survey_observations.source_body IS
  'Raw site dictation before filler cleanup. body is the surveyor-editable cleaned text. Unused by other workspaces.';

COMMENT ON COLUMN public.survey_observations.cleanup_source IS
  'How body was produced: ai (light-tier cleanup) or passthrough (credits/model unavailable). NULL for manual notes.';

-- Existing rows keep body as the working text; source_body stays null until
-- a later site session is cleaned.

NOTIFY pgrst, 'reload schema';
