import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type VideoClickEvent,
  type VideoEditTimeline,
  createDefaultTimeline,
  normalizeTimeline,
} from '~/lib/videos/edit-timeline';

export const VIDEO_MASTERS_BUCKET = 'video-masters';

export function masterStoragePath(accountId: string, videoId: string) {
  return `${accountId}/${videoId}/master.mp4`;
}

export function clicksStoragePath(accountId: string, videoId: string) {
  return `${accountId}/${videoId}/clicks.json`;
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
}) {
  const payload = {
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
