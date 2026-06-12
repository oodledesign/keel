-- Personal home: optionally include workspace-linked tasks in unified views.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS personal_include_workspace_tasks boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_settings.personal_include_workspace_tasks IS
  'When true, personal home and tasks default to showing tasks across all workspaces; when false, life/personal tasks only.';
