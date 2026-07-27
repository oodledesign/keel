import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type VideoClickEvent,
  type VideoEditTimeline,
  type VideoTranscriptWord,
  createDefaultTimeline,
  normalizeTimeline,
  wordsFromPlainText,
} from '~/lib/videos/edit-timeline';

export const VIDEO_MASTERS_BUCKET = 'video-masters';

export function masterStoragePath(accountId: string, videoId: string) {
  return `${accountId}/${videoId}/master.mp4`;
}

export function clicksStoragePath(accountId: string, videoId: string) {
  return `${accountId}/${videoId}/clicks.json`;
}

export function micAudioStoragePath(accountId: string, videoId: string) {
  return `${accountId}/${videoId}/audio-mic.m4a`;
}

export function systemAudioStoragePath(accountId: string, videoId: string) {
  return `${accountId}/${videoId}/audio-system.m4a`;
}

export async function upsertVideoMaster(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  storagePath: string;
  contentType?: string;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  sha256?: string | null;
  micStoragePath?: string | null;
  systemStoragePath?: string | null;
}) {
  const payload: Record<string, unknown> = {
    video_id: input.videoId,
    account_id: input.accountId,
    storage_path: input.storagePath,
    content_type: input.contentType ?? 'video/mp4',
    byte_size: input.byteSize ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    duration_ms: input.durationMs ?? null,
    sha256: input.sha256 ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.micStoragePath !== undefined) {
    payload.mic_storage_path = input.micStoragePath;
  }
  if (input.systemStoragePath !== undefined) {
    payload.system_storage_path = input.systemStoragePath;
  }

  const { data, error } = await input.client
    .from('video_masters')
    .upsert(payload, { onConflict: 'video_id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await input.client
    .from('videos')
    .update({ has_master: true, updated_at: new Date().toISOString() })
    .eq('id', input.videoId);

  return data;
}

export async function ensureEditProject(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  durationMs?: number | null;
  clicks?: VideoClickEvent[];
  userId?: string | null;
}) {
  const { data: existing } = await input.client
    .from('video_edit_projects')
    .select('*')
    .eq('video_id', input.videoId)
    .maybeSingle();

  if (existing) {
    const existingTimeline =
      existing.timeline && typeof existing.timeline === 'object'
        ? existing.timeline
        : {};
    return {
      project: existing,
      timeline: normalizeTimeline(
        existingTimeline,
        Number(
          (existingTimeline as { sourceDurationMs?: number }).sourceDurationMs,
        ) ||
          input.durationMs ||
          0,
      ),
    };
  }

  const timeline = createDefaultTimeline(
    input.durationMs ?? 0,
    input.clicks ?? [],
  );

  const { data, error } = await input.client
    .from('video_edit_projects')
    .insert({
      video_id: input.videoId,
      account_id: input.accountId,
      revision: 1,
      timeline,
      updated_by: input.userId ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await input.client
    .from('videos')
    .update({ edit_revision: 1, updated_at: new Date().toISOString() })
    .eq('id', input.videoId);

  return { project: data, timeline };
}

export async function saveEditTimeline(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  timeline: VideoEditTimeline;
  userId?: string | null;
}) {
  const timeline = normalizeTimeline(
    input.timeline,
    input.timeline.sourceDurationMs,
  );

  const { data: existing } = await input.client
    .from('video_edit_projects')
    .select('id, revision')
    .eq('video_id', input.videoId)
    .maybeSingle();

  const nextRevision = (existing?.revision ?? 0) + 1;

  const { data, error } = await input.client
    .from('video_edit_projects')
    .upsert(
      {
        video_id: input.videoId,
        account_id: input.accountId,
        revision: nextRevision,
        timeline,
        updated_by: input.userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'video_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await input.client
    .from('videos')
    .update({
      edit_revision: nextRevision,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.videoId);

  return { project: data, timeline, revision: nextRevision };
}

/**
 * Instant Loom-style publish: pin timeline for the public watch player.
 * Does not wait for Bunny bake.
 */
export async function publishTimelineInstant(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  timeline: VideoEditTimeline;
  userId?: string | null;
}) {
  const saved = await saveEditTimeline({
    client: input.client,
    videoId: input.videoId,
    accountId: input.accountId,
    timeline: input.timeline,
    userId: input.userId,
  });

  const { data: video, error: videoError } = await input.client
    .from('videos')
    .select('public_share_enabled, public_share_token, has_master')
    .eq('id', input.videoId)
    .single();

  if (videoError) throw new Error(videoError.message);
  if (!video?.has_master) {
    throw new Error('Upload a master recording before publishing edits.');
  }

  let shareToken = video.public_share_token as string | null;
  const shareEnabled = Boolean(video.public_share_enabled);

  const patch: Record<string, unknown> = {
    published_timeline: saved.timeline,
    published_revision: saved.revision,
    updated_at: new Date().toISOString(),
  };

  if (!shareEnabled || !shareToken) {
    shareToken = shareToken || crypto.randomUUID().replace(/-/g, '');
    patch.public_share_enabled = true;
    patch.public_share_token = shareToken;
  }

  const { error } = await input.client
    .from('videos')
    .update(patch)
    .eq('id', input.videoId);

  if (error) throw new Error(error.message);

  return {
    revision: saved.revision,
    timeline: saved.timeline,
    publicShareToken: shareToken as string,
  };
}

/**
 * Seed editor transcript from desktop plain text (Apple Speech).
 * Does not overwrite a ready Whisper/manual transcript unless force=true.
 */
export async function upsertDesktopTranscript(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  plainText: string;
  durationMs?: number | null;
  force?: boolean;
}) {
  const plainText = input.plainText.trim();
  if (!plainText) return null;

  if (!input.force) {
    const { data: existing } = await input.client
      .from('video_transcripts')
      .select('status, provider')
      .eq('video_id', input.videoId)
      .maybeSingle();

    if (
      existing?.status === 'ready' &&
      existing.provider &&
      existing.provider !== 'desktop-speech'
    ) {
      return existing;
    }
  }

  const words: VideoTranscriptWord[] = wordsFromPlainText(
    plainText,
    Math.max(0, input.durationMs ?? 0),
  );

  const { data, error } = await input.client
    .from('video_transcripts')
    .upsert(
      {
        video_id: input.videoId,
        account_id: input.accountId,
        plain_text: plainText,
        words,
        provider: 'desktop-speech',
        status: 'ready',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'video_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createSignedMasterUrl(
  storagePath: string,
  expiresIn = 60 * 60,
) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.storage
    .from(VIDEO_MASTERS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Could not sign master URL');
  }

  return data.signedUrl;
}

export async function downloadMasterBytes(storagePath: string) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.storage
    .from(VIDEO_MASTERS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not download master');
  }

  return Buffer.from(await data.arrayBuffer());
}
