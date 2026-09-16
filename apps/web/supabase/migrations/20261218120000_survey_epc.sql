-- Building-surveyor EPC snapshot from the GOV.UK Energy Certificate Data API.
-- Additive only. Unused by work / commercial-property / personal / family /
-- community workspaces.

-- ---------------------------------------------------------------------------
-- 1. Property lookup fields on the survey_report proposal
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_property_address text,
  ADD COLUMN IF NOT EXISTS survey_property_postcode text,
  ADD COLUMN IF NOT EXISTS survey_uprn text;

COMMENT ON COLUMN public.proposals.survey_property_address IS
  'Building-surveyor property address used for GOV.UK EPC lookup. Unused by other proposal kinds.';

COMMENT ON COLUMN public.proposals.survey_property_postcode IS
  'Building-surveyor postcode used for GOV.UK EPC lookup. Unused by other proposal kinds.';

COMMENT ON COLUMN public.proposals.survey_uprn IS
  'Unique Property Reference Number for this survey property, when known.';

-- ---------------------------------------------------------------------------
-- 2. Attached EPC (one per survey)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_epc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals (id) ON DELETE CASCADE,
  certificate_number text NOT NULL,
  uprn text,
  current_rating text,
  potential_rating text,
  lodgement_date date,
  floor_area numeric,
  fuel_type text,
  recommendations_summary text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT survey_epc_proposal_unique UNIQUE (proposal_id),
  CONSTRAINT survey_epc_certificate_number_format CHECK (
    certificate_number ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}$'
  )
);

CREATE INDEX IF NOT EXISTS ix_survey_epc_account_id
  ON public.survey_epc (account_id);

COMMENT ON TABLE public.survey_epc IS
  'GOV.UK Energy Performance Certificate attached to a building-surveyor survey_report.';

COMMENT ON COLUMN public.survey_epc.raw_json IS
  'Full certificate JSON returned by GET /api/certificate, stored for audit.';

DROP TRIGGER IF EXISTS set_survey_epc_timestamps ON public.survey_epc;
CREATE TRIGGER set_survey_epc_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_epc
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_epc ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_epc FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_epc TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_epc TO service_role;

DROP POLICY IF EXISTS survey_epc_select ON public.survey_epc;
CREATE POLICY survey_epc_select ON public.survey_epc
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS survey_epc_insert ON public.survey_epc;
CREATE POLICY survey_epc_insert ON public.survey_epc
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
    AND EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_id
        AND p.account_id = account_id
        AND p.kind = 'survey_report'
    )
  );

DROP POLICY IF EXISTS survey_epc_update ON public.survey_epc;
CREATE POLICY survey_epc_update ON public.survey_epc
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
    AND EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_id
        AND p.account_id = account_id
        AND p.kind = 'survey_report'
    )
  );

DROP POLICY IF EXISTS survey_epc_delete ON public.survey_epc;
CREATE POLICY survey_epc_delete ON public.survey_epc
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

NOTIFY pgrst, 'reload schema';
