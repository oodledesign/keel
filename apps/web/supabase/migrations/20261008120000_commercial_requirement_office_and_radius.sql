-- Link website/internal requirements to a workspace office, and allow
-- PropertyHive-style “this area only” / quarter-mile search radii.

ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS branch_id uuid
    REFERENCES public.account_branches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_requirements_branch_id_idx
  ON public.commercial_requirements (account_id, branch_id);

COMMENT ON COLUMN public.commercial_requirements.branch_id IS
  'Workspace office the applicant registered with / is handled by.';

ALTER TABLE public.commercial_requirements
  DROP CONSTRAINT IF EXISTS commercial_requirements_search_radius_miles_check;

ALTER TABLE public.commercial_requirements
  ADD CONSTRAINT commercial_requirements_search_radius_miles_check
  CHECK (
    search_radius_miles IS NULL
    OR (search_radius_miles >= 0 AND search_radius_miles <= 100)
  );
