-- Personal dashboard shortcuts, default landing workspace, per-workspace shortcuts.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_landing_type text NOT NULL DEFAULT 'personal'
    CHECK (default_landing_type IN ('personal', 'workspace')),
  ADD COLUMN IF NOT EXISTS default_workspace_slug text,
  ADD COLUMN IF NOT EXISTS personal_dashboard_shortcuts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_settings.default_landing_type IS
  'Where the user lands after sign-in: personal home or a team workspace.';
COMMENT ON COLUMN public.user_settings.default_workspace_slug IS
  'Team workspace slug when default_landing_type = workspace.';
COMMENT ON COLUMN public.user_settings.personal_dashboard_shortcuts IS
  'Ordered array of { id, catalogId, params, label? } for personal dashboard quick links.';

CREATE TABLE IF NOT EXISTS public.workspace_dashboard_shortcuts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  shortcuts jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);

CREATE INDEX IF NOT EXISTS ix_workspace_dashboard_shortcuts_account_id
  ON public.workspace_dashboard_shortcuts(account_id);

COMMENT ON TABLE public.workspace_dashboard_shortcuts IS
  'Per-user shortcut pins for a team workspace dashboard.';

DROP TRIGGER IF EXISTS workspace_dashboard_shortcuts_set_timestamps
  ON public.workspace_dashboard_shortcuts;
CREATE TRIGGER workspace_dashboard_shortcuts_set_timestamps
  BEFORE UPDATE ON public.workspace_dashboard_shortcuts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.workspace_dashboard_shortcuts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_dashboard_shortcuts
  TO authenticated, service_role;

DROP POLICY IF EXISTS workspace_dashboard_shortcuts_select
  ON public.workspace_dashboard_shortcuts;
CREATE POLICY workspace_dashboard_shortcuts_select
  ON public.workspace_dashboard_shortcuts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS workspace_dashboard_shortcuts_insert
  ON public.workspace_dashboard_shortcuts;
CREATE POLICY workspace_dashboard_shortcuts_insert
  ON public.workspace_dashboard_shortcuts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.user_id = auth.uid() AND am.account_id = workspace_dashboard_shortcuts.account_id
    )
  );

DROP POLICY IF EXISTS workspace_dashboard_shortcuts_update
  ON public.workspace_dashboard_shortcuts;
CREATE POLICY workspace_dashboard_shortcuts_update
  ON public.workspace_dashboard_shortcuts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS workspace_dashboard_shortcuts_delete
  ON public.workspace_dashboard_shortcuts;
CREATE POLICY workspace_dashboard_shortcuts_delete
  ON public.workspace_dashboard_shortcuts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
