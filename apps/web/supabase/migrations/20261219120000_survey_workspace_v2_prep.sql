-- Survey Workspace v2 (Build 0 / schema recon).
-- Additive only. Building-surveyor / proposals.kind = survey_report.
-- Does not change work / commercial-property / personal / family / community.
--
-- Unlocks P1 (address + EPC + flood prep):
--   * survey_level 2|3 visibility driver (one template)
--   * address / postcode / UPRN if missing on main
--   * flood placeholder columns
--
-- EPC: PR #173 is OPEN (not on main at recon time). Do not create
-- public.survey_epc here. Address column names match #173 so
-- ADD COLUMN IF NOT EXISTS is a no-op whichever lands first.
--
-- Near-main apply order:
--   20261215120000_survey_capture_phase1.sql
--   20261216120000_survey_capture_phase2.sql
--   20261216120000_survey_path_a_field_constraints.sql
--   20261217120000_survey_report_body_document.sql
--   20261218120000_survey_templates_phrase_banks.sql   -- PR #172, if merged
--   20261218120000_survey_epc.sql                      -- PR #173, if merged
--   20261219120000_survey_workspace_v2_prep.sql        -- this file

-- ---------------------------------------------------------------------------
-- 1. Level 2 | 3 visibility driver (one RICS Home Survey template)
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_level smallint;

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_survey_level_check;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_survey_level_check
  CHECK (survey_level IS NULL OR survey_level IN (2, 3));

COMMENT ON COLUMN public.proposals.survey_level IS
  'RICS Home Survey level (2 or 3). Visibility driver for the shared section catalogue. NULL for ordinary proposals.';

-- Dual-write from the Phase 1 template key. L1 and specialist keys default to 2.
UPDATE public.proposals
SET survey_level = CASE
  WHEN survey_type = 'rics_hss_l3' THEN 3
  ELSE 2
END
WHERE kind = 'survey_report'
  AND survey_level IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Address / UPRN — same names as PR #173 (IF NOT EXISTS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_property_address text,
  ADD COLUMN IF NOT EXISTS survey_property_postcode text,
  ADD COLUMN IF NOT EXISTS survey_uprn text;

COMMENT ON COLUMN public.proposals.survey_property_address IS
  'Building-surveyor property address for project prep and GOV.UK EPC lookup. Unused by other proposal kinds.';

COMMENT ON COLUMN public.proposals.survey_property_postcode IS
  'Building-surveyor postcode for project prep and GOV.UK EPC lookup. Unused by other proposal kinds.';

COMMENT ON COLUMN public.proposals.survey_uprn IS
  'Unique Property Reference Number for this survey property, when known.';

CREATE INDEX IF NOT EXISTS ix_proposals_survey_uprn
  ON public.proposals (survey_uprn)
  WHERE survey_uprn IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Flood risk (P1 fills from EA OGC Features + flood-monitoring; no key)
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_flood_risk_band text,
  ADD COLUMN IF NOT EXISTS survey_flood_risk_summary text,
  ADD COLUMN IF NOT EXISTS survey_flood_source text,
  ADD COLUMN IF NOT EXISTS survey_flood_raw_json jsonb,
  ADD COLUMN IF NOT EXISTS survey_flood_fetched_at timestamptz;

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_survey_flood_source_check;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_survey_flood_source_check
  CHECK (
    survey_flood_source IS NULL
    OR survey_flood_source IN ('placeholder', 'manual', 'gov_uk')
  );

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_survey_flood_risk_band_check;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_survey_flood_risk_band_check
  CHECK (
    survey_flood_risk_band IS NULL
    OR survey_flood_risk_band IN ('very_low', 'low', 'medium', 'high')
  );

COMMENT ON COLUMN public.proposals.survey_flood_risk_band IS
  'Placeholder flood-risk band for building-surveyor project prep (e.g. very_low, low, medium, high). Unused by other proposal kinds.';

COMMENT ON COLUMN public.proposals.survey_flood_risk_summary IS
  'Short flood-risk summary shown in project prep. Filled by P1.';

COMMENT ON COLUMN public.proposals.survey_flood_source IS
  'How flood data was attached: placeholder, manual, or gov_uk. NULL until P1.';

COMMENT ON COLUMN public.proposals.survey_flood_raw_json IS
  'Raw flood-risk payload for audit. Empty until P1.';

COMMENT ON COLUMN public.proposals.survey_flood_fetched_at IS
  'When flood-risk data was last pulled or entered.';

NOTIFY pgrst, 'reload schema';
