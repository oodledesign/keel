import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

const AVATARS_BUCKET = 'account_image';

function extensionForMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

function storagePathFromPictureUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed || !trimmed.includes('/account_image/')) {
    return null;
  }

  return trimmed.split('/account_image/')[1]?.split('?')[0] ?? null;
}

export async function loadPersonalAccountPicture(
  client: SupabaseClient,
  userId: string,
) {
  const { data, error } = await client
    .from('accounts')
    .select('id, picture_url')
    .eq('primary_owner_user_id', userId)
    .eq('is_personal_account', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string; picture_url: string | null } | null) ?? null;
}

/** Uploads to `account_image` and points the personal account at it. */
export async function storePersonalProfileImage(input: {
  client: SupabaseClient;
  account: { id: string; picture_url: string | null };
  bytes: Buffer;
  contentType: string;
}) {
  const bucket = getSupabaseServerAdminClient().storage.from(AVATARS_BUCKET);
  const existingPath = storagePathFromPictureUrl(input.account.picture_url);
  const path = `${input.account.id}.${extensionForMime(input.contentType)}`;

  if (existingPath && existingPath !== path) {
    await bucket.remove([existingPath]);
  }

  const { error: uploadError } = await bucket.upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: true,
  });

  if (uploadError) {
    console.error('[account] upload-profile-image:', uploadError.message);
    throw new Error(uploadError.message || 'Failed to upload profile image.');
  }

  const publicUrl = toSupabasePublicStorageUrl(
    bucket.getPublicUrl(path).data.publicUrl,
  );

  if (!publicUrl) {
    throw new Error('Upload succeeded but public URL could not be generated.');
  }

  const { nanoid } = await import('nanoid');
  const pictureUrl = `${publicUrl}?v=${nanoid(16)}`;

  const { error: updateError } = await input.client
    .from('accounts')
    .update({ picture_url: pictureUrl })
    .eq('id', input.account.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return pictureUrl;
}

export async function removePersonalProfileImage(input: {
  client: SupabaseClient;
  account: { id: string; picture_url: string | null };
}) {
  const existingPath = storagePathFromPictureUrl(input.account.picture_url);
  if (existingPath) {
    await getSupabaseServerAdminClient()
      .storage.from(AVATARS_BUCKET)
      .remove([existingPath]);
  }

  const { error } = await input.client
    .from('accounts')
    .update({ picture_url: null })
    .eq('id', input.account.id);

  if (error) {
    throw new Error(error.message);
  }
}
