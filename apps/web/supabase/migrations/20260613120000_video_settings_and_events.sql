-- Account-level video hosting settings and webhook event log.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS video_settings jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.accounts.video_settings IS
  'Video hosting: default_player_preset_id, bunny_library_id override, bunny_api_key_encrypted.';

CREATE TABLE IF NOT EXISTS public.video_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts (id) ON DELETE SET NULL,
  bunny_video_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_video_events_account_id
  ON public.video_events (account_id);

CREATE INDEX IF NOT EXISTS ix_video_events_bunny_video_id
  ON public.video_events (bunny_video_id);

CREATE INDEX IF NOT EXISTS ix_video_events_created_at
  ON public.video_events (created_at DESC);

COMMENT ON TABLE public.video_events IS 'Audit log for Bunny Stream webhook events.';

ALTER TABLE public.video_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.video_events TO service_role;

-- Work/agency-style workspaces: ensure videos module stays enabled by default.
INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, 'videos', true
FROM public.accounts a
WHERE coalesce(a.space_type, 'work') = 'work'
ON CONFLICT (account_id, module_key) DO UPDATE
SET enabled = EXCLUDED.enabled
WHERE public.account_module_settings.module_key = 'videos';

NOTIFY pgrst, 'reload schema';
