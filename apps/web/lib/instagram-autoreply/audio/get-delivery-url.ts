import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Json } from '@kit/supabase/database';

import { type IgAttachmentType, uploadMessageAttachment } from '../graph-api';
import { IG_ASSETS_BUCKET } from './process-asset-upload';

/** Long enough for Meta to fetch the file, short enough to be useless if leaked. */
const DELIVERY_URL_TTL_SECONDS = 600;
const PREVIEW_URL_TTL_SECONDS = 300;

export type IgDeliverableAsset = {
  id: string;
  account_id: string;
  kind: 'audio' | 'image' | 'video' | 'pdf';
  delivery_path: string | null;
  transcode_status: string;
  meta_attachment_ids: Json;
};

export function attachmentTypeForKind(
  kind: IgDeliverableAsset['kind'],
): IgAttachmentType {
  return kind === 'pdf' ? 'file' : kind;
}

/**
 * Signed URL for in-memory use only (Meta fetch or in-app preview).
 * Never write the return value to the database or logs.
 */
export async function createAssetSignedUrl(
  admin: SupabaseClient,
  path: string,
  ttlSeconds = DELIVERY_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await admin.storage
    .from(IG_ASSETS_BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    throw new Error('Could not prepare the media file for sending');
  }
  return data.signedUrl;
}

export async function createAssetPreviewUrl(
  admin: SupabaseClient,
  path: string,
): Promise<string> {
  return createAssetSignedUrl(admin, path, PREVIEW_URL_TTL_SECONDS);
}

function readCachedAttachmentId(
  cache: Json,
  igAccountId: string,
): string | null {
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;
  const value = (cache as Record<string, Json | undefined>)[igAccountId];
  return typeof value === 'string' && value ? value : null;
}

/**
 * Returns a reusable Meta attachment id for the asset, uploading it once per
 * connected Instagram account. Only the id is cached; the signed URL is not.
 */
export async function getOrCreateMetaAttachmentId(params: {
  admin: SupabaseClient;
  asset: IgDeliverableAsset;
  igAccountId: string;
  igBusinessAccountId: string;
  accessToken: string;
}): Promise<string> {
  const { asset } = params;
  if (asset.transcode_status !== 'ready' || !asset.delivery_path) {
    throw new Error('This media file is not ready to send yet');
  }

  const cached = readCachedAttachmentId(
    asset.meta_attachment_ids,
    params.igAccountId,
  );
  if (cached) return cached;

  const signedUrl = await createAssetSignedUrl(
    params.admin,
    asset.delivery_path,
  );
  const attachmentId = await uploadMessageAttachment(
    params.igBusinessAccountId,
    params.accessToken,
    { type: attachmentTypeForKind(asset.kind), url: signedUrl },
  );

  const nextCache: Record<string, Json> = {
    ...((asset.meta_attachment_ids &&
    typeof asset.meta_attachment_ids === 'object' &&
    !Array.isArray(asset.meta_attachment_ids)
      ? asset.meta_attachment_ids
      : {}) as Record<string, Json>),
    [params.igAccountId]: attachmentId,
  };

  await params.admin
    .from('ig_automation_assets')
    .update({ meta_attachment_ids: nextCache })
    .eq('id', asset.id);

  return attachmentId;
}
