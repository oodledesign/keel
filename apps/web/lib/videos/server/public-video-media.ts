import 'server-only';

import { NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildCaptionCues,
  transcriptHasRealTimings,
} from '~/lib/videos/captions';
import {
  type VideoTranscriptWord,
  normalizeTimeline,
} from '~/lib/videos/edit-timeline';

import { createSignedMasterUrl } from './video-edit.service';

export const PUBLIC_VIDEO_MEDIA_SELECT =
  'id, account_id, title, has_master, published_timeline, published_revision, duration_seconds';

export type PublicMediaVideo = {
  id: string;
  title: string;
  has_master: boolean | null;
  published_timeline: unknown;
  published_revision: number | null;
  duration_seconds: number | null;
};

/**
 * Signed media + timeline for the public timeline player.
 * Callers must have authorised access to `video` first (own share token, or a
 * shared folder containing it). Never exposes the private bucket — short-lived
 * signed URLs only.
 */
export async function buildPublicVideoMediaResponse(
  admin: SupabaseClient,
  video: PublicMediaVideo | null,
) {
  if (!video?.has_master || !video.published_timeline) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: master } = await admin
    .from('video_masters')
    .select('storage_path, mic_storage_path, system_storage_path, duration_ms')
    .eq('video_id', video.id)
    .maybeSingle();

  if (!master?.storage_path) {
    return NextResponse.json({ error: 'Master missing' }, { status: 404 });
  }

  const expiresIn = 60 * 60;
  const masterUrl = await createSignedMasterUrl(
    String(master.storage_path),
    expiresIn,
  );

  let micUrl: string | null = null;
  let systemUrl: string | null = null;
  if (master.mic_storage_path) {
    try {
      micUrl = await createSignedMasterUrl(
        String(master.mic_storage_path),
        expiresIn,
      );
    } catch {
      micUrl = null;
    }
  }
  if (master.system_storage_path) {
    try {
      systemUrl = await createSignedMasterUrl(
        String(master.system_storage_path),
        expiresIn,
      );
    } catch {
      systemUrl = null;
    }
  }

  const durationMs =
    master.duration_ms ??
    (video.duration_seconds != null
      ? Number(video.duration_seconds) * 1000
      : 0);
  const timeline = normalizeTimeline(video.published_timeline, durationMs);

  const { data: transcript } = await admin
    .from('video_transcripts')
    .select('words, provider, status')
    .eq('video_id', video.id)
    .maybeSingle();

  const words = (transcript?.words ?? []) as VideoTranscriptWord[];
  const captions =
    transcript?.status === 'ready' &&
    transcriptHasRealTimings(transcript.provider as string | null, words)
      ? buildCaptionCues(words, timeline.keepRanges)
      : [];

  return NextResponse.json({
    ok: true,
    title: video.title,
    masterUrl,
    micUrl,
    systemUrl,
    expiresIn,
    publishedRevision: video.published_revision ?? 0,
    timeline,
    captions,
  });
}
