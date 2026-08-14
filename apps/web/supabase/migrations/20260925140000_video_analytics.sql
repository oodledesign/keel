-- Bunny Stream analytics cache + daily rollups (views / watch time).

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_time_seconds bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_score integer,
  ADD COLUMN IF NOT EXISTS analytics_synced_at timestamptz;

COMMENT ON COLUMN public.videos.view_count IS
  'Cached Bunny Stream playback starts (lifetime window synced from statistics API).';
COMMENT ON COLUMN public.videos.watch_time_seconds IS
  'Cached Bunny Stream watch time in seconds (lifetime window synced from statistics API).';
COMMENT ON COLUMN public.videos.engagement_score IS
  'Bunny Stream engagement score 0–100 when available.';
COMMENT ON COLUMN public.videos.analytics_synced_at IS
  'When view/watch analytics were last pulled from Bunny Stream.';

CREATE TABLE IF NOT EXISTS public.video_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos (id) ON DELETE CASCADE,
  day date NOT NULL,
  views bigint NOT NULL DEFAULT 0,
  watch_time_seconds bigint NOT NULL DEFAULT 0,
  country_views jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_analytics_daily_video_day_unique UNIQUE (video_id, day)
);

CREATE INDEX IF NOT EXISTS ix_video_analytics_daily_account_day
  ON public.video_analytics_daily (account_id, day DESC);

CREATE INDEX IF NOT EXISTS ix_video_analytics_daily_video_day
  ON public.video_analytics_daily (video_id, day DESC);

CREATE INDEX IF NOT EXISTS ix_videos_analytics_synced_at
  ON public.videos (analytics_synced_at ASC NULLS FIRST)
  WHERE status = 'ready';

COMMENT ON TABLE public.video_analytics_daily IS
  'Daily Bunny Stream view/watch-time rollups per hosted video.';

ALTER TABLE public.video_analytics_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.video_analytics_daily FROM authenticated, service_role;
GRANT SELECT ON public.video_analytics_daily TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.video_analytics_daily TO service_role;

-- Analytics cache columns on videos are service-written only.
REVOKE UPDATE (
  view_count,
  watch_time_seconds,
  engagement_score,
  analytics_synced_at
) ON public.videos FROM authenticated;

DROP POLICY IF EXISTS video_analytics_daily_select ON public.video_analytics_daily;
CREATE POLICY video_analytics_daily_select ON public.video_analytics_daily
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS video_analytics_daily_insert ON public.video_analytics_daily;
DROP POLICY IF EXISTS video_analytics_daily_update ON public.video_analytics_daily;
DROP POLICY IF EXISTS video_analytics_daily_delete ON public.video_analytics_daily;

NOTIFY pgrst, 'reload schema';
