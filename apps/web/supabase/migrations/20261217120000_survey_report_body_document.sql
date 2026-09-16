-- Structured survey report blocks (heading / text / image), used only for
-- proposals.kind = survey_report. Ordinary proposals keep content_html only.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS body_document jsonb;

COMMENT ON COLUMN public.proposals.body_document IS
  'Structured survey report blocks (heading/text/image). Used for survey_report documents; compiled HTML is also stored in content_html for the portal.';
