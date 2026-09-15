-- Survey capture Phase 2: firm style examples, curated photo captions,
-- and a client bulk photo share token.
-- Additive only. Does not change work / commercial-property / personal /
-- family / community behaviour.

-- ---------------------------------------------------------------------------
-- 1. Firm-level past-report style examples (building-surveyor only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_style_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  title text NOT NULL,
  original_filename text,
  mime_type text,
  storage_bucket text NOT NULL DEFAULT 'account-documents',
  file_path text,
  extracted_text text,
  style_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_survey_style_examples_account_id
  ON public.survey_style_examples (account_id, created_at DESC);

COMMENT ON TABLE public.survey_style_examples IS
  'Building-surveyor past reports used to condition draft style. Unused by other workspaces.';

DROP TRIGGER IF EXISTS set_survey_style_examples_timestamps ON public.survey_style_examples;
CREATE TRIGGER set_survey_style_examples_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_style_examples
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_style_examples ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_style_examples FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_style_examples TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_style_examples TO service_role;

DROP POLICY IF EXISTS survey_style_examples_select ON public.survey_style_examples;
CREATE POLICY survey_style_examples_select ON public.survey_style_examples
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_style_examples_insert ON public.survey_style_examples;
CREATE POLICY survey_style_examples_insert ON public.survey_style_examples
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_style_examples_update ON public.survey_style_examples;
CREATE POLICY survey_style_examples_update ON public.survey_style_examples
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_style_examples_delete ON public.survey_style_examples;
CREATE POLICY survey_style_examples_delete ON public.survey_style_examples
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Curated photo captions + order (docs stay archive by default)
-- ---------------------------------------------------------------------------
ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS caption text;

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS curated_sort_order integer;

COMMENT ON COLUMN public.docs.caption IS
  'Optional survey photo caption. Grounded in section observations when AI-proposed.';

COMMENT ON COLUMN public.docs.curated_sort_order IS
  'Order of curated survey photos within a pinned section. NULL for archive files.';

-- ---------------------------------------------------------------------------
-- 3. Client bulk photo share (brochure-style token, not embedded in PDF)
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS photo_share_token text;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS photo_share_enabled boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS ix_proposals_photo_share_token
  ON public.proposals (photo_share_token)
  WHERE photo_share_token IS NOT NULL;

COMMENT ON COLUMN public.proposals.photo_share_token IS
  'Public token for the building-surveyor full photo set. Unused by other proposal kinds.';

COMMENT ON COLUMN public.proposals.photo_share_enabled IS
  'When true, /share/survey-photos/[token] shows the survey photo library.';
