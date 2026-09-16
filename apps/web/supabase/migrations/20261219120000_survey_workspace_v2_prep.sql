-- Building-surveyor Survey Workspace v2 Phase 1 (prep).
-- Address pin + Environment Agency flood snapshot.
-- Additive only. Unused by work / commercial-property / personal / family /
-- community workspaces. Dual-write safe (IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- 1. Map pin on the survey_report proposal (Mapbox / existing geocoding)
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_property_latitude double precision,
  ADD COLUMN IF NOT EXISTS survey_property_longitude double precision;

COMMENT ON COLUMN public.proposals.survey_property_latitude IS
  'Building-surveyor WGS84 latitude for EA flood-zone lookup. Unused by other proposal kinds.';

COMMENT ON COLUMN public.proposals.survey_property_longitude IS
  'Building-surveyor WGS84 longitude for EA flood-zone lookup. Unused by other proposal kinds.';

-- ---------------------------------------------------------------------------
-- 2. Attached flood risk (one per survey)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_flood (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals (id) ON DELETE CASCADE,
  flood_zone text,
  rivers_and_sea text,
  surface_water text,
  summary text,
  active_warning_count integer NOT NULL DEFAULT 0,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  pulled_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  overridden_fields text[] NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT survey_flood_proposal_unique UNIQUE (proposal_id),
  CONSTRAINT survey_flood_zone_check CHECK (
    flood_zone IS NULL OR flood_zone IN ('1', '2', '3')
  )
);

CREATE INDEX IF NOT EXISTS ix_survey_flood_account_id
  ON public.survey_flood (account_id);

COMMENT ON TABLE public.survey_flood IS
  'Environment Agency Flood Map for Planning snapshot attached to a building-surveyor survey_report.';

COMMENT ON COLUMN public.survey_flood.flood_zone IS
  'Planning flood zone 1, 2 or 3 from EA Flood Map for Planning WFS.';

COMMENT ON COLUMN public.survey_flood.pulled_json IS
  'Auto-pulled flood field snapshot. Surveyor edits stay in the typed columns.';

COMMENT ON COLUMN public.survey_flood.overridden_fields IS
  'Field names the surveyor overrode after auto-pull.';

-- Dual-write: if survey_flood already exists from a prior branch, add columns.
ALTER TABLE public.survey_flood
  ADD COLUMN IF NOT EXISTS flood_zone text,
  ADD COLUMN IF NOT EXISTS rivers_and_sea text,
  ADD COLUMN IF NOT EXISTS surface_water text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS active_warning_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pulled_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS overridden_fields text[] NOT NULL DEFAULT '{}';

DROP TRIGGER IF EXISTS set_survey_flood_timestamps ON public.survey_flood;
CREATE TRIGGER set_survey_flood_timestamps
  BEFORE INSERT OR UPDATE ON public.survey_flood
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.survey_flood ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.survey_flood FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_flood TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_flood TO service_role;

DROP POLICY IF EXISTS survey_flood_select ON public.survey_flood;
CREATE POLICY survey_flood_select ON public.survey_flood
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS survey_flood_insert ON public.survey_flood;
CREATE POLICY survey_flood_insert ON public.survey_flood
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

DROP POLICY IF EXISTS survey_flood_update ON public.survey_flood;
CREATE POLICY survey_flood_update ON public.survey_flood
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

DROP POLICY IF EXISTS survey_flood_delete ON public.survey_flood;
CREATE POLICY survey_flood_delete ON public.survey_flood
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
