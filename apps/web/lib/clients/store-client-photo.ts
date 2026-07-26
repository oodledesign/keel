import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

const AVATARS_BUCKET = 'account_image';

export function storagePathFromClientPictureUrl(
  url: string | null | undefined,
) {
  const trimmed = url?.trim();
  if (!trimmed || !trimmed.includes('/account_image/')) {
    return null;
  }

  return trimmed.split('/account_image/')[1]?.split('?')[0] ?? null;
}

function clientPhotoPath(accountId: string, clientId: string) {
  return `${accountId}/client-${clientId}`;
}

export async function storeClientPhotoBytes(input: {
  accountId: string;
  clientId: string;
  existingPictureUrl: string | null;
  bytes: Buffer;
  contentType: string;
}) {
  const admin = getSupabaseServerAdminClient();
  const bucket = admin.storage.from(AVATARS_BUCKET);
  const existingPath = storagePathFromClientPictureUrl(
    input.existingPictureUrl,
  );
  const nextPath = clientPhotoPath(input.accountId, input.clientId);

  if (existingPath && existingPath !== nextPath) {
    await bucket.remove([existingPath]);
  }

  const { error: uploadError } = await bucket.upload(nextPath, input.bytes, {
    contentType: input.contentType || 'image/png',
    upsert: true,
  });

  if (uploadError) {
    console.error('[clients] upload-photo:', uploadError.message);
    throw new Error(uploadError.message || 'Failed to upload photo.');
  }

  const publicUrl = toSupabasePublicStorageUrl(
    bucket.getPublicUrl(nextPath).data.publicUrl,
  );

  if (!publicUrl) {
    throw new Error('Upload succeeded but public URL could not be generated.');
  }

  const { nanoid } = await import('nanoid');
  const pictureUrl = `${publicUrl}?v=${nanoid(16)}`;

  const { error: updateError } = await admin
    .from('clients')
    .update({
      picture_url: pictureUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.clientId)
    .eq('account_id', input.accountId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return pictureUrl;
}
