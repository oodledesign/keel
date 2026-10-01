-- Report front cover.
--   * proposals.survey_cover_photo_doc_id: the survey photo chosen for the
--     cover (a doc from that survey's photo library).
--   * survey_account_settings.cover_image_path: the workspace default cover
--     image, used when a survey has no cover photo of its own.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_cover_photo_doc_id uuid
    REFERENCES public.docs (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.proposals.survey_cover_photo_doc_id IS
  'Photo (docs.id) shown on the report front cover. Survey reports only.';

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_cover_focus jsonb;

COMMENT ON COLUMN public.proposals.survey_cover_focus IS
  'Crop and position of the cover image: {x, y, zoom}. x/y 0-1, zoom 1-3.';

CREATE INDEX IF NOT EXISTS ix_proposals_survey_cover_photo
  ON public.proposals (survey_cover_photo_doc_id)
  WHERE survey_cover_photo_doc_id IS NOT NULL;

ALTER TABLE public.survey_account_settings
  ADD COLUMN IF NOT EXISTS cover_image_path text;

COMMENT ON COLUMN public.survey_account_settings.cover_image_path IS
  'Storage path (account docs bucket) of the default report cover image.';

NOTIFY pgrst, 'reload schema';
