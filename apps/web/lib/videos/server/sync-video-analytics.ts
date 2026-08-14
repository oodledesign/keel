import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createBunnyStreamClient } from '@kit/bunny';
import { getLogger } from '@kit/shared/logger';

import {
  resolveAccountBunnyApiKey,
  resolveAccountBunnyLibraryId,
} from './videos-data';

export const DEFAULT_STALE_MS = 60 * 60 * 1000;
export const PUBLIC_STALE_MS = 15 * 60 * 1000;

type AnalyticsVideoRow = {
  id: string;
  account_id: string;
  bunny_video_id: string;
  bunny_library_id: string;
  created_at: string;
  status: string;
  analytics_synced_at?: string | null;
  view_count?: number;
  watch_time_seconds?: number;
  engagement_score?: number | null;
};

function sumChart(chart: Record<string, number>): number {
  let total = 0;
  for (const value of Object.values(chart)) {
    total += Number(value) || 0;
  }
  return Math.max(0, Math.round(total));
}

function dayKeyFromChartBucket(bucket: string): string | null {
  // Bunny returns "YYYY-MM-DD" (daily) or ISO-like hourly keys.
  const day = bucket.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  return day;
}

function isStale(
  syncedAt: string | null | undefined,
  staleAfterMs: number,
): boolean {
  if (!syncedAt) return true;
  const ts = new Date(syncedAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts >= staleAfterMs;
}

export async function syncVideoAnalyticsForRow(
  admin: SupabaseClient,
  video: AnalyticsVideoRow,
): Promise<{
  viewCount: number;
  watchTimeSeconds: number;
  engagementScore: number | null;
}> {
  const logger = await getLogger();
  const apiKey = await resolveAccountBunnyApiKey(admin, video.account_id);
  const libraryId =
    video.bunny_library_id?.trim() ||
    (await resolveAccountBunnyLibraryId(admin, video.account_id));

  const bunny = createBunnyStreamClient(apiKey);
  const rawCreatedAt = new Date(video.created_at);
  const dateFrom = Number.isFinite(rawCreatedAt.getTime())
    ? rawCreatedAt
    : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  // Pull a little earlier than create so first-day views aren't clipped.
  dateFrom.setUTCDate(dateFrom.getUTCDate() - 1);

  const stats = await bunny.getVideoStatistics(libraryId, {
    videoGuid: video.bunny_video_id,
    dateFrom: dateFrom.toISOString(),
    dateTo: new Date().toISOString(),
    hourly: false,
  });

  const viewCount = sumChart(stats.viewsChart);
  const watchTimeSeconds = sumChart(stats.watchTimeChart);
  const engagementScore = stats.engagementScore;
  const syncedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from('videos')
    .update({
      view_count: viewCount,
      watch_time_seconds: watchTimeSeconds,
      engagement_score: engagementScore,
      analytics_synced_at: syncedAt,
    } as never)
    .eq('id', video.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const days = new Map<string, { views: number; watchTimeSeconds: number }>();

  for (const [bucket, views] of Object.entries(stats.viewsChart)) {
    const day = dayKeyFromChartBucket(bucket);
    if (!day) continue;
    const current = days.get(day) ?? { views: 0, watchTimeSeconds: 0 };
    current.views += Number(views) || 0;
    days.set(day, current);
  }

  for (const [bucket, watch] of Object.entries(stats.watchTimeChart)) {
    const day = dayKeyFromChartBucket(bucket);
    if (!day) continue;
    const current = days.get(day) ?? { views: 0, watchTimeSeconds: 0 };
    current.watchTimeSeconds += Number(watch) || 0;
    days.set(day, current);
  }

  if (days.size > 0) {
    const rows = [...days.entries()].map(([day, totals]) => ({
      account_id: video.account_id,
      video_id: video.id,
      day,
      views: Math.max(0, Math.round(totals.views)),
      watch_time_seconds: Math.max(0, Math.round(totals.watchTimeSeconds)),
      country_views: {},
      synced_at: syncedAt,
    }));

    const { error: upsertError } = await admin
      .from('video_analytics_daily')
      .upsert(rows as never, { onConflict: 'video_id,day' });

    if (upsertError) {
      logger.warn(
        {
          name: 'videos.analytics.daily_upsert',
          videoId: video.id,
          error: upsertError.message,
        },
        'Failed to upsert daily video analytics',
      );
    }
  }

  return { viewCount, watchTimeSeconds, engagementScore };
}

export async function syncVideoAnalyticsIfStale(
  admin: SupabaseClient,
  video: AnalyticsVideoRow,
  options?: { staleAfterMs?: number },
): Promise<
  AnalyticsVideoRow & {
    view_count: number;
    watch_time_seconds: number;
    engagement_score: number | null;
  }
> {
  const staleAfterMs = options?.staleAfterMs ?? PUBLIC_STALE_MS;

  if (video.status !== 'ready') {
    return {
      ...video,
      view_count: Number(video.view_count ?? 0),
      watch_time_seconds: Number(video.watch_time_seconds ?? 0),
      engagement_score: video.engagement_score ?? null,
    };
  }

  if (!isStale(video.analytics_synced_at, staleAfterMs)) {
    return {
      ...video,
      view_count: Number(video.view_count ?? 0),
      watch_time_seconds: Number(video.watch_time_seconds ?? 0),
      engagement_score: video.engagement_score ?? null,
    };
  }

  try {
    const result = await syncVideoAnalyticsForRow(admin, video);
    return {
      ...video,
      analytics_synced_at: new Date().toISOString(),
      view_count: result.viewCount,
      watch_time_seconds: result.watchTimeSeconds,
      engagement_score: result.engagementScore,
    };
  } catch (error) {
    const logger = await getLogger();
    logger.warn(
      {
        name: 'videos.analytics.sync',
        videoId: video.id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Video analytics sync failed; serving cached counts',
    );

    const { data } = await admin
      .from('videos')
      .select(
        'id, account_id, bunny_video_id, bunny_library_id, created_at, status, analytics_synced_at, view_count, watch_time_seconds, engagement_score',
      )
      .eq('id', video.id)
      .maybeSingle();

    return {
      ...video,
      view_count: Number(
        (data as { view_count?: number } | null)?.view_count ?? 0,
      ),
      watch_time_seconds: Number(
        (data as { watch_time_seconds?: number } | null)?.watch_time_seconds ??
          0,
      ),
      engagement_score: ((data as { engagement_score?: number | null } | null)
        ?.engagement_score ?? null) as number | null,
    };
  }
}

export async function syncStaleVideoAnalyticsBatch(
  admin: SupabaseClient,
  options?: { limit?: number; staleAfterMs?: number },
): Promise<{ scanned: number; synced: number; failed: number }> {
  const logger = await getLogger();
  const limit = options?.limit ?? 40;
  const staleAfterMs = options?.staleAfterMs ?? DEFAULT_STALE_MS;
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();

  const { data, error } = await admin
    .from('videos')
    .select(
      'id, account_id, bunny_video_id, bunny_library_id, created_at, status, analytics_synced_at',
    )
    .eq('status', 'ready')
    .or(`analytics_synced_at.is.null,analytics_synced_at.lt.${cutoff}`)
    .order('analytics_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AnalyticsVideoRow[];
  let synced = 0;
  let failed = 0;

  for (const video of rows) {
    try {
      await syncVideoAnalyticsForRow(admin, video);
      synced += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        {
          name: 'videos.analytics.batch',
          videoId: video.id,
          error: err instanceof Error ? err.message : String(err),
        },
        'Failed to sync video analytics',
      );
    }
  }

  return { scanned: rows.length, synced, failed };
}
