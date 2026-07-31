-- Align commercial deal pipeline stages with Kato interest-schedule statuses,
-- and allow per-account rename/hide overrides.

CREATE TABLE IF NOT EXISTS public.pipeline_board_stage_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.pipeline_board_stage_settings IS
  'Per-account pipeline board stage overrides (label + hidden). Keys stay canonical.';

COMMENT ON COLUMN public.pipeline_board_stage_settings.stages IS
  'JSON array of { key, label, hidden } objects for the commercial deal board.';

ALTER TABLE public.pipeline_board_stage_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_board_stage_settings
  TO authenticated, service_role;

DROP POLICY IF EXISTS pipeline_board_stage_settings_select
  ON public.pipeline_board_stage_settings;
CREATE POLICY pipeline_board_stage_settings_select
  ON public.pipeline_board_stage_settings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS pipeline_board_stage_settings_insert
  ON public.pipeline_board_stage_settings;
CREATE POLICY pipeline_board_stage_settings_insert
  ON public.pipeline_board_stage_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS pipeline_board_stage_settings_update
  ON public.pipeline_board_stage_settings;
CREATE POLICY pipeline_board_stage_settings_update
  ON public.pipeline_board_stage_settings
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  )
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS pipeline_board_stage_settings_delete
  ON public.pipeline_board_stage_settings;
CREATE POLICY pipeline_board_stage_settings_delete
  ON public.pipeline_board_stage_settings
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

-- Remap legacy commercial deal stages → Kato defaults for commercial workspaces.
UPDATE public.pipeline_deals AS d
SET
  stage = CASE d.stage
    WHEN 'offer' THEN 'negotiating'
    WHEN 'hots' THEN 'under_offer'
    WHEN 'solicitors' THEN 'under_offer'
    WHEN 'completed' THEN 'signed'
    WHEN 'fell_through' THEN 'discounted'
    ELSE d.stage
  END,
  completed_at = CASE
    WHEN d.stage = 'completed' AND d.completed_at IS NULL THEN now()
    WHEN d.stage = 'fell_through' THEN NULL
    WHEN d.stage IN ('offer', 'hots', 'solicitors') THEN d.completed_at
    ELSE d.completed_at
  END
FROM public.accounts AS a
WHERE d.account_id = a.id
  AND a.space_type = 'commercial-property'
  AND d.stage IN ('offer', 'hots', 'solicitors', 'completed', 'fell_through');
