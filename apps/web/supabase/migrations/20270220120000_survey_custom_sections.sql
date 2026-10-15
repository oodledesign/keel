-- Custom survey sections, brochure origin tracking, commercial template key.
-- Additive only; builds on survey_templates / survey_observations / proposals.

ALTER TABLE public.survey_templates
  ADD COLUMN IF NOT EXISTS sections jsonb;

COMMENT ON COLUMN public.survey_templates.sections IS
  'Optional section overrides (null = built-in catalogue). Custom keys use custom_<slug>.';

ALTER TABLE public.survey_templates
  DROP CONSTRAINT IF EXISTS survey_templates_system_key_check;

ALTER TABLE public.survey_templates
  ADD CONSTRAINT survey_templates_system_key_check
  CHECK (system_key IN ('rics_hss_l3', 'rics_hss_l2', 'commercial_building_survey'));

ALTER TABLE public.survey_templates
  DROP CONSTRAINT IF EXISTS survey_templates_survey_type_check;

ALTER TABLE public.survey_templates
  ADD CONSTRAINT survey_templates_survey_type_check
  CHECK (survey_type IN ('rics_hss_l3', 'rics_hss_l2', 'commercial_building_survey'));

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_sections jsonb;

COMMENT ON COLUMN public.proposals.survey_sections IS
  'Snapshot of resolved survey sections taken when the survey is created.';

ALTER TABLE public.survey_observations
  ADD COLUMN IF NOT EXISTS origin text;

ALTER TABLE public.survey_observations
  ADD COLUMN IF NOT EXISTS origin_doc_id uuid;

ALTER TABLE public.survey_observations
  ADD COLUMN IF NOT EXISTS origin_body text;

ALTER TABLE public.survey_observations
  DROP CONSTRAINT IF EXISTS survey_observations_origin_check;

ALTER TABLE public.survey_observations
  ADD CONSTRAINT survey_observations_origin_check
  CHECK (
    origin IS NULL
    OR origin IN (
      'dictation',
      'manual',
      'phrase',
      'brochure_exact',
      'brochure_ai',
      'edited'
    )
  );

COMMENT ON COLUMN public.survey_observations.origin IS
  'How the note was created (dictation, manual, phrase, brochure_exact, brochure_ai, edited).';

COMMENT ON COLUMN public.survey_observations.origin_doc_id IS
  'Source document id when the note came from a brochure PDF import.';

COMMENT ON COLUMN public.survey_observations.origin_body IS
  'Original imported body; used to detect Edited vs From PDF pills.';

NOTIFY pgrst, 'reload schema';
