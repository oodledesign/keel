import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { createBunnyStreamClient } from '@kit/bunny';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getDefaultAccountPath } from '~/home/[account]/_lib/role-access';
import { isVideosModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '~/home/[account]/_lib/server/workspace-route-guard';

import { detectAspectRatio } from '../player-config-types';
import { buildPublicVideoWatchUrl } from '../public-share';
import type { VideoRow } from '../types';
import { normalizeVideoChapters } from './generate-video-chapters';
import { normalizeVideoSummary } from './generate-video-summary';
import {
  configValuesFromRow,
  loadAccountPresets,
  loadVideoPlayerConfig,
  resolveEffectivePlayerConfig,
} from './player-config-data';
import { syncVideoAnalyticsIfStale } from './sync-video-analytics';
import { requireVideoById } from './videos-access';
import { getBunnyCdnHostname } from './videos-data';

export async function loadVideoPlayerConfigPage(
  accountSlug: string,
  videoId: string,
) {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ADDON_APPS_SPACE_TYPES);

  if (!isVideosModuleEnabled(workspace.moduleSettings)) {
    redirect(
      getDefaultAccountPath(
        accountSlug,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const access = await requireVideoById(videoId);

  if (access.error === 'UNAUTHORIZED') {
    redirect('/auth/sign-in');
  }

  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    notFound();
  }

  const video = access.video as VideoRow;
  const accountId = video.account_id;

  if (video.account_id !== workspace.account.id) {
    notFound();
  }

  const admin = getSupabaseServerAdminClient();
  const analytics = await syncVideoAnalyticsIfStale(admin, {
    id: video.id,
    account_id: accountId,
    bunny_video_id: video.bunny_video_id,
    bunny_library_id: video.bunny_library_id,
    created_at: video.created_at,
    status: video.status,
    analytics_synced_at: video.analytics_synced_at ?? null,
    view_count: video.view_count,
    watch_time_seconds: video.watch_time_seconds,
    engagement_score: video.engagement_score,
  });

  const [configRow, presets, resolved] = await Promise.all([
    loadVideoPlayerConfig(access.client, videoId),
    loadAccountPresets(access.client, accountId),
    resolveEffectivePlayerConfig(access.client, accountId, videoId),
  ]);

  const bunny = createBunnyStreamClient();
  const [captionsResult, bunnyVideoResult, transcriptResult] =
    await Promise.allSettled([
      bunny.listCaptions(
        String(video.bunny_library_id),
        String(video.bunny_video_id),
      ),
      bunny.getVideo(
        String(video.bunny_library_id),
        String(video.bunny_video_id),
      ),
      access.client
        .from('video_transcripts')
        .select('plain_text, status')
        .eq('video_id', videoId)
        .maybeSingle(),
    ]);
  const captions =
    captionsResult.status === 'fulfilled' ? captionsResult.value : [];
  const detectedAspectRatio =
    bunnyVideoResult.status === 'fulfilled'
      ? detectAspectRatio(
          bunnyVideoResult.value.width,
          bunnyVideoResult.value.height,
        )
      : '16:9';
  const transcriptRow =
    transcriptResult.status === 'fulfilled'
      ? transcriptResult.value.data
      : null;
  const transcriptPlainText =
    transcriptRow?.status === 'ready'
      ? String(transcriptRow.plain_text ?? '').trim() || null
      : null;
  const config = configRow
    ? configValuesFromRow(configRow)
    : resolved.source === 'default'
      ? { ...resolved.config, aspect_ratio: detectedAspectRatio }
      : resolved.config;

  return {
    accountSlug,
    accountId,
    video: {
      id: video.id as string,
      title: video.title as string,
      bunny_library_id: String(video.bunny_library_id),
      bunny_video_id: String(video.bunny_video_id),
      status: video.status as string,
      viewCount: analytics.view_count,
      watchTimeSeconds: analytics.watch_time_seconds,
      engagementScore: analytics.engagement_score,
      analyticsSyncedAt: analytics.analytics_synced_at ?? null,
      publicShareEnabled: Boolean(video.public_share_enabled),
      publicShareToken: (video.public_share_token as string | null) ?? null,
      publicShareUrl:
        video.public_share_enabled && video.public_share_token
          ? buildPublicVideoWatchUrl(String(video.public_share_token))
          : null,
      publishedAt:
        (video.published_at as string | null | undefined) ??
        (video.created_at as string | null) ??
        null,
      chapters: normalizeVideoChapters(video.chapters),
      summary: normalizeVideoSummary(video.summary),
    },
    transcriptPlainText,
    config,
    detectedAspectRatio,
    configSource: configRow ? 'video' : resolved.source,
    configId: configRow?.id ?? null,
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      values: configValuesFromRow(preset),
    })),
    captions,
    cdnHostname: getBunnyCdnHostname(),
  };
}
