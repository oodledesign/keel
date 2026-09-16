-- Phase 0–1 Bracketts-parity: RICS ratings, workspace survey templates,
-- and per-surveyor phrase banks (GoReport Predefined Responses import).
--
-- Apply order (building-surveyor only; additive):
--   1. 20261215120000_survey_capture_phase1.sql
--   2. 20261216120000_survey_capture_phase2.sql
--   3. 20261216120000_survey_path_a_field_constraints.sql
--   4. 20261217120000_survey_report_body_document.sql
--   5. 20261218120000_survey_templates_phrase_banks.sql  (this file)
--
-- Does not change work / commercial-property / personal / family behaviour.

-- ---------------------------------------------------------------------------
-- 1. Condition ratings + RICS codes on observations
-- ---------------------------------------------------------------------------
ALTER TABLE public.survey_observations
  ADD COLUMN IF NOT EXISTS condition_rating text;

ALTER TABLE public.survey_observations
  ADD COLUMN IF NOT EXISTS rics_code text;

ALTER TABLE public.survey_observations
  DROP CONSTRAINT IF EXISTS survey_observations_condition_rating_check;

ALTER TABLE public.survey_observations
  ADD CONSTRAINT survey_observations_condition_rating_check
  CHECK (
    condition_rating IS NULL
    OR condition_rating IN ('1', '2', '3', 'NA', 'NI')
  );

CREATE INDEX IF NOT EXISTS ix_survey_observations_rics_code
  ON public.survey_observations (proposal_id, rics_code)
  WHERE rics_code IS NOT NULL;

COMMENT ON COLUMN public.survey_observations.condition_rating IS
  'RICS condition rating: 1, 2, 3, NA, or NI. NULL until the surveyor sets one.';

COMMENT ON COLUMN public.survey_observations.rics_code IS
  'RICS Home Survey code (D2, H1, J.valuation, …) aligned with the section catalogue.';

-- ---------------------------------------------------------------------------
-- 2. Workspace-clonable survey templates (system shells live in app code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  system_key text NOT NULL,
  survey_type text NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  surveyor_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_system_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT survey_templates_system_key_check
    CHECK (system_key IN ('rics_hss_l3', 'rics_hss_l2')),
  CONSTRAINT survey_templates_survey_type_check
    CHECK (survey_type IN ('rics_hss_l3', 'rics_hss_l2'))
);

CREATE INDEX IF NOT EXISTS ix_survey_templates_account_id
  ON public.survey_templates (account_id, survey_type, is_default);

CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_templates_one_default
  ON public.survey_templates (account_id, survey_type)
  WHERE is_default;

COMMENT ON TABLE public.survey_templates IS
  'Building-surveyor workspace clones of system RICS report shells (static blocks + slots).';

DROP TRIGGER IF EXISTS set_survey_templates_timestamps ON public.survey_templates;
CREATE TRIGGER set_survey_templates_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_templates FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_templates TO service_role;

DROP POLICY IF EXISTS survey_templates_select ON public.survey_templates;
CREATE POLICY survey_templates_select ON public.survey_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_templates_insert ON public.survey_templates;
CREATE POLICY survey_templates_insert ON public.survey_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_templates_update ON public.survey_templates;
CREATE POLICY survey_templates_update ON public.survey_templates
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

DROP POLICY IF EXISTS survey_templates_delete ON public.survey_templates;
CREATE POLICY survey_templates_delete ON public.survey_templates
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_template_id uuid REFERENCES public.survey_templates (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.proposals.survey_template_id IS
  'Optional workspace survey template used when assembling a survey_report. NULL falls back to the system shell for survey_type.';

-- ---------------------------------------------------------------------------
-- 3. Phrase banks (personal or workspace-shared) + phrases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_phrase_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'personal',
  name text NOT NULL,
  source text,
  survey_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT survey_phrase_banks_scope_check
    CHECK (scope IN ('personal', 'workspace'))
);

CREATE INDEX IF NOT EXISTS ix_survey_phrase_banks_account_user
  ON public.survey_phrase_banks (account_id, user_id, scope);

COMMENT ON TABLE public.survey_phrase_banks IS
  'Building-surveyor phrase banks. Personal banks are per user; workspace banks are shared with the account. Not seeded for all tenants.';

DROP TRIGGER IF EXISTS set_survey_phrase_banks_timestamps ON public.survey_phrase_banks;
CREATE TRIGGER set_survey_phrase_banks_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_phrase_banks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_phrase_banks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_phrase_banks FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_phrase_banks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_phrase_banks TO service_role;

DROP POLICY IF EXISTS survey_phrase_banks_select ON public.survey_phrase_banks;
CREATE POLICY survey_phrase_banks_select ON public.survey_phrase_banks
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
    AND (
      scope = 'workspace'
      OR user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS survey_phrase_banks_insert ON public.survey_phrase_banks;
CREATE POLICY survey_phrase_banks_insert ON public.survey_phrase_banks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
  );

DROP POLICY IF EXISTS survey_phrase_banks_update ON public.survey_phrase_banks;
CREATE POLICY survey_phrase_banks_update ON public.survey_phrase_banks
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      scope = 'workspace'
      OR user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.space_type = 'building-surveyor'
    )
    AND (
      scope = 'workspace'
      OR user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS survey_phrase_banks_delete ON public.survey_phrase_banks;
CREATE POLICY survey_phrase_banks_delete ON public.survey_phrase_banks
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      (scope = 'personal' AND user_id = (SELECT auth.uid()))
      OR scope = 'workspace'
    )
  );

CREATE TABLE IF NOT EXISTS public.survey_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.survey_phrase_banks (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  rics_code text,
  section_key text,
  tags text[] NOT NULL DEFAULT '{}',
  default_rating text,
  goreport_path text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT survey_phrases_default_rating_check
    CHECK (
      default_rating IS NULL
      OR default_rating IN ('1', '2', '3', 'NA', 'NI')
    )
);

CREATE INDEX IF NOT EXISTS ix_survey_phrases_bank_id
  ON public.survey_phrases (bank_id, sort_order);

CREATE INDEX IF NOT EXISTS ix_survey_phrases_rics_code
  ON public.survey_phrases (account_id, rics_code);

COMMENT ON TABLE public.survey_phrases IS
  'Reusable surveyor phrases mapped onto RICS codes / template slots.';

DROP TRIGGER IF EXISTS set_survey_phrases_timestamps ON public.survey_phrases;
CREATE TRIGGER set_survey_phrases_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_phrases
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_phrases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_phrases FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_phrases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_phrases TO service_role;

DROP POLICY IF EXISTS survey_phrases_select ON public.survey_phrases;
CREATE POLICY survey_phrases_select ON public.survey_phrases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_phrase_banks b
      WHERE b.id = bank_id
        AND public.has_role_on_account(b.account_id)
        AND (
          b.scope = 'workspace'
          OR b.user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS survey_phrases_insert ON public.survey_phrases;
CREATE POLICY survey_phrases_insert ON public.survey_phrases
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.survey_phrase_banks b
      WHERE b.id = bank_id
        AND b.account_id = survey_phrases.account_id
        AND public.has_role_on_account(b.account_id)
        AND (
          b.scope = 'workspace'
          OR b.user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS survey_phrases_update ON public.survey_phrases;
CREATE POLICY survey_phrases_update ON public.survey_phrases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_phrase_banks b
      WHERE b.id = bank_id
        AND public.has_role_on_account(b.account_id)
        AND (
          b.scope = 'workspace'
          OR b.user_id = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.survey_phrase_banks b
      WHERE b.id = bank_id
        AND public.has_role_on_account(b.account_id)
        AND (
          b.scope = 'workspace'
          OR b.user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS survey_phrases_delete ON public.survey_phrases;
CREATE POLICY survey_phrases_delete ON public.survey_phrases
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_phrase_banks b
      WHERE b.id = bank_id
        AND public.has_role_on_account(b.account_id)
        AND (
          b.scope = 'workspace'
          OR b.user_id = (SELECT auth.uid())
        )
    )
  );
