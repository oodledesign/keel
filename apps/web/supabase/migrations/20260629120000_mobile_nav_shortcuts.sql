-- Mobile bottom navigation shortcuts (up to 3 per personal / workspace context).

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS personal_mobile_nav_shortcuts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_settings.personal_mobile_nav_shortcuts IS
  'Ordered array of up to 3 { id, catalogId, params, label? } for personal mobile bottom nav.';

ALTER TABLE public.workspace_dashboard_shortcuts
  ADD COLUMN IF NOT EXISTS mobile_nav_shortcuts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workspace_dashboard_shortcuts.mobile_nav_shortcuts IS
  'Ordered array of up to 3 { id, catalogId, params, label? } for workspace mobile bottom nav.';

NOTIFY pgrst, 'reload schema';
