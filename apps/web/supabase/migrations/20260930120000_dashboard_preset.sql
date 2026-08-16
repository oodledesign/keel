-- Per-user dashboard layout preset for team workspace home.
-- Additive only: nullable column on existing workspace_dashboard_shortcuts.

ALTER TABLE public.workspace_dashboard_shortcuts
  ADD COLUMN IF NOT EXISTS dashboard_preset text
  CHECK (
    dashboard_preset IN ('overview', 'pipeline', 'tasks', 'finance')
    OR dashboard_preset IS NULL
  );

COMMENT ON COLUMN public.workspace_dashboard_shortcuts.dashboard_preset IS
  'Work dashboard layout preset: overview | pipeline | tasks | finance. NULL = not chosen yet.';

NOTIFY pgrst, 'reload schema';
