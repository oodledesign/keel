import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { VideoPlayerConfigValues } from '../player-config-types';
import {
  resolveVideoThumbnailCandidates,
  resolveVideoThumbnailUrl,
} from '../thumbnail';
import type { VideoChapter, VideoRow } from '../types';
import { normalizeVideoChapters } from './generate-video-chapters';
import { normalizeVideoSummary } from './generate-video-summary';
import { resolveEffectivePlayerConfig } from './player-config-data';
import { syncVideoAnalyticsIfStale } from './sync-video-analytics';
import { resolveBunnyCdnHostname } from './videos-data';

export type PublicVideoPageData = {
  video: VideoRow;
  config: VideoPlayerConfigValues;
  /** Prefer player-composed master + published timeline (instant edits). */
  useTimelinePlayer: boolean;
  chapters: VideoChapter[];
  publishedAt: string | null;
  transcriptPlainText: string | null;
  summary: string | null;
};

export const loadPublicVideoByToken = cache(
  async function loadPublicVideoByToken(
    token: string,
  ): Promise<PublicVideoPageData | null> {
    const admin = getSupabaseServerAdminClient();

    const { data, error } = await admin
      .from('videos')
      .select('*')
      .eq('public_share_token', token)
      .eq('public_share_enabled', true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const baseVideo = data as VideoRow;
    const analytics = await syncVideoAnalyticsIfStale(admin, {
      id: baseVideo.id,
      account_id: baseVideo.account_id,
      bunny_video_id: baseVideo.bunny_video_id,
      bunny_library_id: baseVideo.bunny_library_id,
      created_at: baseVideo.created_at,
      status: baseVideo.status,
      analytics_synced_at: baseVideo.analytics_synced_at ?? null,
      view_count: baseVideo.view_count,
      watch_time_seconds: baseVideo.watch_time_seconds,
      engagement_score: baseVideo.engagement_score,
    });

    const video: VideoRow = {
      ...baseVideo,
      view_count: analytics.view_count,
      watch_time_seconds: analytics.watch_time_seconds,
      engagement_score: analytics.engagement_score,
      analytics_synced_at: analytics.analytics_synced_at,
    };

    const resolved = await resolveEffectivePlayerConfig(
      admin,
      video.account_id,
      video.id,
    );

    const cdnHostname = await resolveBunnyCdnHostname(video.bunny_library_id);
    const thumbnail_url =
      resolveVideoThumbnailUrl(video, cdnHostname) ?? video.thumbnail_url;
    const thumbnail_candidates = resolveVideoThumbnailCandidates(
      { ...video, thumbnail_url },
      cdnHostname,
    );

    const useTimelinePlayer = Boolean(
      video.has_master &&
      video.published_timeline &&
      Number(video.published_revision ?? 0) > 0,
    );

    const { data: transcript } = await admin
      .from('video_transcripts')
      .select('plain_text, status')
      .eq('video_id', video.id)
      .maybeSingle();

    const transcriptPlainText =
      transcript?.status === 'ready'
        ? String(transcript.plain_text ?? '').trim() || null
        : null;

    return {
      video: {
        ...video,
        thumbnail_url,
        thumbnail_candidates,
      },
      config: resolved.config,
      useTimelinePlayer,
      chapters: normalizeVideoChapters(video.chapters),
      publishedAt:
        (video.published_at as string | null | undefined) ??
        video.created_at ??
        null,
      transcriptPlainText,
      summary: normalizeVideoSummary(video.summary),
    };
  },
);
