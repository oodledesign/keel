-- Link Rightmove Commercial Listings agent/branch IDs to workspace branches,
-- and allow disposals to be assigned to a workspace branch.

ALTER TABLE public.account_branches
  ADD COLUMN IF NOT EXISTS rightmove_branch_id text;

COMMENT ON COLUMN public.account_branches.rightmove_branch_id IS
  'Numeric Rightmove Commercial Listings branch/agent ID for this office. Used as building.agentId when publishing disposals assigned to this branch.';

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS account_branch_id uuid
    REFERENCES public.account_branches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_listings_account_branch_id_idx
  ON public.commercial_listings (account_branch_id)
  WHERE account_branch_id IS NOT NULL;

COMMENT ON COLUMN public.commercial_listings.account_branch_id IS
  'Workspace office/branch responsible for this disposal (signatures + Rightmove publish agentId).';
