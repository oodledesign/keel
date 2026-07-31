-- Allow users (e.g. project guests) to skip creating team workspaces after signup.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS workspace_setup_skipped_at timestamptz;

COMMENT ON COLUMN public.user_settings.workspace_setup_skipped_at IS
  'When set, the user dismissed /setup and continues with their personal account only.';
