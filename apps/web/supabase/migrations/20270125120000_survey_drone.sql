-- Drone usage on surveys and quotes.
--   * proposals: whether a drone was used, how it is billed and the fee.
--     Applies to survey reports and to the standardised surveyor quote.
--   * survey_account_settings: per-workspace defaults for surveys (drone fee).

-- ---------------------------------------------------------------------------
-- 1. Per-document drone fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_drone_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS survey_drone_billing text NOT NULL DEFAULT 'separate',
  ADD COLUMN IF NOT EXISTS survey_drone_fee_pence integer;

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_survey_drone_billing_check;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_survey_drone_billing_check
  CHECK (survey_drone_billing IN ('separate', 'included'));

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_survey_drone_fee_check;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_survey_drone_fee_check
  CHECK (survey_drone_fee_pence IS NULL OR survey_drone_fee_pence >= 0);

COMMENT ON COLUMN public.proposals.survey_drone_used IS
  'True when a drone is used for the inspection. Survey reports and surveyor quotes.';
COMMENT ON COLUMN public.proposals.survey_drone_billing IS
  'separate = charged as its own quote line; included = covered by the survey fee.';
COMMENT ON COLUMN public.proposals.survey_drone_fee_pence IS
  'Drone fee in minor units when billed separately. NULL uses the workspace default.';

-- Lets reporting count drone surveys per workspace cheaply.
CREATE INDEX IF NOT EXISTS ix_proposals_survey_drone_used
  ON public.proposals (account_id)
  WHERE survey_drone_used;

-- ---------------------------------------------------------------------------
-- 2. Workspace survey defaults
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_account_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  drone_fee_pence integer NOT NULL DEFAULT 15000
    CONSTRAINT survey_account_settings_drone_fee_check CHECK (drone_fee_pence >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.survey_account_settings IS
  'Per-workspace defaults for building-surveyor surveys and quotes.';
COMMENT ON COLUMN public.survey_account_settings.drone_fee_pence IS
  'Default drone fee in minor units (15000 = 150.00).';

DROP TRIGGER IF EXISTS survey_account_settings_set_timestamps
  ON public.survey_account_settings;
CREATE TRIGGER survey_account_settings_set_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_account_settings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_account_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_account_settings FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_account_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_account_settings TO service_role;

DROP POLICY IF EXISTS survey_account_settings_read ON public.survey_account_settings;
CREATE POLICY survey_account_settings_read ON public.survey_account_settings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS survey_account_settings_insert ON public.survey_account_settings;
CREATE POLICY survey_account_settings_insert ON public.survey_account_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account (account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_account_settings_update ON public.survey_account_settings;
CREATE POLICY survey_account_settings_update ON public.survey_account_settings
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account (account_id))
  WITH CHECK (public.has_role_on_account (account_id));

NOTIFY pgrst, 'reload schema';
