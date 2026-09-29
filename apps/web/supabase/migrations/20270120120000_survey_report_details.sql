-- Survey report details for the RICS Home Survey PDF.
--   * surveyor_profiles: per-surveyor RICS number, contact details and
--     qualifications, shown on the cover, section A and the declaration (K).
--   * proposals: inspection date, report reference, terms received date,
--     accommodation matrix and services grids (survey_report only).

-- ---------------------------------------------------------------------------
-- 1. Surveyor profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surveyor_profiles (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  rics_number text,
  phone text,
  email text,
  website text,
  address text,
  qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surveyor_profiles_account_user_key UNIQUE (account_id, user_id),
  CONSTRAINT surveyor_profiles_qualifications_array
    CHECK (jsonb_typeof(qualifications) = 'array')
);

COMMENT ON TABLE public.surveyor_profiles IS
  'Per-surveyor details (RICS number, contact, qualifications) used in RICS Home Survey reports.';

CREATE INDEX IF NOT EXISTS ix_surveyor_profiles_user
  ON public.surveyor_profiles (user_id);

DROP TRIGGER IF EXISTS surveyor_profiles_set_timestamps ON public.surveyor_profiles;
CREATE TRIGGER surveyor_profiles_set_timestamps
  BEFORE INSERT OR UPDATE ON public.surveyor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.surveyor_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.surveyor_profiles FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveyor_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveyor_profiles TO service_role;

DROP POLICY IF EXISTS surveyor_profiles_read ON public.surveyor_profiles;
CREATE POLICY surveyor_profiles_read ON public.surveyor_profiles
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS surveyor_profiles_insert_own ON public.surveyor_profiles;
CREATE POLICY surveyor_profiles_insert_own ON public.surveyor_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid ())
    AND public.has_role_on_account (account_id)
  );

DROP POLICY IF EXISTS surveyor_profiles_update_own ON public.surveyor_profiles;
CREATE POLICY surveyor_profiles_update_own ON public.surveyor_profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid ())
    AND public.has_role_on_account (account_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid ())
    AND public.has_role_on_account (account_id)
  );

DROP POLICY IF EXISTS surveyor_profiles_delete_own ON public.surveyor_profiles;
CREATE POLICY surveyor_profiles_delete_own ON public.surveyor_profiles
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid ())
    AND public.has_role_on_account (account_id)
  );

-- ---------------------------------------------------------------------------
-- 2. Per-survey report details
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS survey_inspection_date date,
  ADD COLUMN IF NOT EXISTS survey_report_reference text,
  ADD COLUMN IF NOT EXISTS survey_terms_received_date date,
  ADD COLUMN IF NOT EXISTS survey_accommodation jsonb,
  ADD COLUMN IF NOT EXISTS survey_services jsonb;

COMMENT ON COLUMN public.proposals.survey_inspection_date IS
  'Date the surveyor inspected the property. Survey reports only.';
COMMENT ON COLUMN public.proposals.survey_report_reference IS
  'Surveyor report reference shown in section A. Survey reports only.';
COMMENT ON COLUMN public.proposals.survey_terms_received_date IS
  'Date the signed terms and conditions were received, shown in the Reminder callout.';
COMMENT ON COLUMN public.proposals.survey_accommodation IS
  'Accommodation matrix: { floorKey: { roomKey: count } }. Survey reports only.';
COMMENT ON COLUMN public.proposals.survey_services IS
  'Services present: { main: string[], heating: string[] }. Survey reports only.';

NOTIFY pgrst, 'reload schema';
