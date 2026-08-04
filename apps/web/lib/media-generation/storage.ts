import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export const MEDIA_GENERATION_BUCKET = 'media-generation';

/**
 * Upload a reference or result file under {accountId}/... and return a signed URL.
 */
export async function uploadMediaGenerationFile(params: {
  accountId: string;
  pathSuffix: string;
  bytes: ArrayBuffer | Buffer | Uint8Array;
  contentType: string;
  signedUrlExpiresIn?: number;
}): Promise<{ path: string; signedUrl: string }> {
  const admin = getSupabaseServerAdminClient();
  const path = `${params.accountId}/${params.pathSuffix}`;
  const body =
    params.bytes instanceof Buffer
      ? params.bytes
      : Buffer.from(params.bytes as ArrayBuffer);

  const { error } = await admin.storage
    .from(MEDIA_GENERATION_BUCKET)
    .upload(path, body, {
      contentType: params.contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data, error: signError } = await admin.storage
    .from(MEDIA_GENERATION_BUCKET)
    .createSignedUrl(path, params.signedUrlExpiresIn ?? 60 * 60);

  if (signError || !data?.signedUrl) {
    throw new Error(signError?.message ?? 'Failed to create signed URL');
  }

  return { path, signedUrl: data.signedUrl };
}

export async function persistRemoteMediaToStorage(params: {
  accountId: string;
  remoteUrl: string;
  pathSuffix: string;
  contentTypeHint?: string;
}): Promise<{ path: string; signedUrl: string; contentType: string }> {
  const res = await fetch(params.remoteUrl);
  if (!res.ok) {
    throw new Error(`Failed to download provider asset (${res.status})`);
  }

  const contentType =
    params.contentTypeHint ??
    res.headers.get('content-type') ??
    'application/octet-stream';
  const bytes = Buffer.from(await res.arrayBuffer());

  const uploaded = await uploadMediaGenerationFile({
    accountId: params.accountId,
    pathSuffix: params.pathSuffix,
    bytes,
    contentType,
    signedUrlExpiresIn: 60 * 60 * 24 * 7,
  });

  return { ...uploaded, contentType };
}
