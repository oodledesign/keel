-- Archive for commercial WIP instructions and requirements.
--
-- Archived rows are hidden from the WIP board, totals, reports, matching and
-- circulation, and can be restored. They are not deleted. Permanent delete is
-- a separate, owner/admin-only action in the app.

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pipeline_deals.archived_at IS
  'When this instruction was archived. NULL means active. Archived rows are hidden from the WIP board, totals and reports.';
COMMENT ON COLUMN public.pipeline_deals.archived_by IS
  'User who archived this instruction.';
COMMENT ON COLUMN public.commercial_requirements.archived_at IS
  'When this requirement was archived. NULL means active. Archived rows are excluded from matching and circulation.';
COMMENT ON COLUMN public.commercial_requirements.archived_by IS
  'User who archived this requirement.';
