import 'server-only';

import { nanoid } from 'nanoid';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

const ACCOUNT_IMAGE_BUCKET = 'account_image';

export function isStoredRecipeImageUrl(url: string | null | undefined) {
  return Boolean(url?.includes('/account_image/'));
}

export function storagePathFromRecipeImageUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed || !trimmed.includes('/account_image/')) {
    return null;
  }

  return trimmed.split('/account_image/')[1]?.split('?')[0] ?? null;
}

export function recipeCoverPath(ownerAccountId: string, recipeId: string) {
  return `${ownerAccountId}/recipe-${recipeId}`;
}

/**
 * Copy a recipe cover into the public account_image bucket.
 * Path: {personal user id | workspace account id}/recipe-{recipeId}
 * Same bucket as account/client/people photos — Instagram CDN URLs expire,
 * so we persist a copy rather than hotlinking.
 */
export async function storeRecipeCoverBytes(input: {
  ownerAccountId: string;
  recipeId: string;
  existingImageUrl: string | null;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  const admin = getSupabaseServerAdminClient();
  const bucket = admin.storage.from(ACCOUNT_IMAGE_BUCKET);
  const existingPath = storagePathFromRecipeImageUrl(input.existingImageUrl);
  const nextPath = recipeCoverPath(input.ownerAccountId, input.recipeId);

  if (existingPath && existingPath !== nextPath) {
    await bucket.remove([existingPath]);
  }

  const { error: uploadError } = await bucket.upload(nextPath, input.bytes, {
    contentType: input.contentType || 'image/jpeg',
    upsert: true,
  });

  if (uploadError) {
    console.error('[family-recipes] upload-cover:', uploadError.message);
    throw new Error(uploadError.message || 'Failed to save recipe photo.');
  }

  const publicUrl = toSupabasePublicStorageUrl(
    bucket.getPublicUrl(nextPath).data.publicUrl,
  );

  if (!publicUrl) {
    throw new Error('Upload succeeded but public URL could not be generated.');
  }

  return `${publicUrl}?v=${nanoid(16)}`;
}

export async function removeRecipeCover(existingImageUrl: string | null) {
  const existingPath = storagePathFromRecipeImageUrl(existingImageUrl);
  if (!existingPath) return;

  const admin = getSupabaseServerAdminClient();
  await admin.storage.from(ACCOUNT_IMAGE_BUCKET).remove([existingPath]);
}
