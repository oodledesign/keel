-- Survey capture Phase 1: template key, transcript↔survey link,
-- editable section observations, and archive vs curated photo hook.
-- Additive only. Does not change work / commercial-property / personal /
-- family / community behaviour.

-- ---------------------------------------------------------------------------
-- 1. Thin survey template key on the existing survey_report proposal
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_type text;

COMMENT ON COLUMN public.proposals.survey_type IS
  'Building-surveyor template key (e.g. rics_hss_l2). NULL for ordinary proposals.';

-- ---------------------------------------------------------------------------
-- 2. Link site transcripts to a survey report
-- ---------------------------------------------------------------------------
ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_proposal_id
  ON public.meeting_transcripts (proposal_id)
  WHERE proposal_id IS NOT NULL;

COMMENT ON COLUMN public.meeting_transcripts.proposal_id IS
  'Optional link to a survey report (proposals.kind = survey_report). Unused by other workspaces.';

-- ---------------------------------------------------------------------------
-- 3. Archive vs curated photo role (Phase 1: manual pin = curated)
-- ---------------------------------------------------------------------------
ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS photo_role text NOT NULL DEFAULT 'archive';

ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_photo_role_check;
ALTER TABLE public.docs ADD CONSTRAINT docs_photo_role_check
  CHECK (photo_role IN ('archive', 'curated'));

COMMENT ON COLUMN public.docs.photo_role IS
  'Survey photo library role. archive = retained record; curated = intended for the report. Other docs stay archive.';

-- ---------------------------------------------------------------------------
-- 4. Editable observations grouped onto RICS section keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals (id) ON DELETE CASCADE,
  transcript_id uuid REFERENCES public.meeting_transcripts (id) ON DELETE SET NULL,
  section_key text NOT NULL,
  body text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_survey_observations_proposal_id
  ON public.survey_observations (proposal_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS ix_survey_observations_account_id
  ON public.survey_observations (account_id);

COMMENT ON TABLE public.survey_observations IS
  'Building-surveyor site observations grouped onto BUILDING_SURVEY_SECTIONS keys.';

DROP TRIGGER IF EXISTS set_survey_observations_timestamps ON public.survey_observations;
CREATE TRIGGER set_survey_observations_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_observations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_observations FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_observations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_observations TO service_role;

DROP POLICY IF EXISTS survey_observations_select ON public.survey_observations;
CREATE POLICY survey_observations_select ON public.survey_observations
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS survey_observations_insert ON public.survey_observations;
CREATE POLICY survey_observations_insert ON public.survey_observations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_observations_update ON public.survey_observations;
CREATE POLICY survey_observations_update ON public.survey_observations
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

DROP POLICY IF EXISTS survey_observations_delete ON public.survey_observations;
CREATE POLICY survey_observations_delete ON public.survey_observations
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );
