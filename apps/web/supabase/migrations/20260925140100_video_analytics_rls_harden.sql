-- Harden analytics write access: only service_role/cron should mutate stats.

REVOKE UPDATE (
  view_count,
  watch_time_seconds,
  engagement_score,
  analytics_synced_at
) ON public.videos FROM authenticated;

REVOKE ALL ON public.video_analytics_daily FROM authenticated, service_role;
GRANT SELECT ON public.video_analytics_daily TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.video_analytics_daily TO service_role;

DROP POLICY IF EXISTS video_analytics_daily_insert ON public.video_analytics_daily;
DROP POLICY IF EXISTS video_analytics_daily_update ON public.video_analytics_daily;
DROP POLICY IF EXISTS video_analytics_daily_delete ON public.video_analytics_daily;

NOTIFY pgrst, 'reload schema';
