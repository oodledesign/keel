import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { BrandLogoVariant } from '~/lib/brand/resolve-brand-logo';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import { saveBrandLogoVariant, syncWorkspaceLogo } from './sync-workspace-logo';

const BRAND_ASSETS_BUCKET = 'brand-assets';

function extensionForMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

/**
 * Stores a logo in `brand-assets`. The primary logo is synced to the workspace
 * avatar, brand templates, and agency portal. Callers must check access first.
 */
export async function uploadWorkspaceLogo(input: {
  accountId: string;
  variant: 'primary' | BrandLogoVariant;
  bytes: Buffer;
  contentType: string;
}) {
  const ext = extensionForMime(input.contentType);
  const path =
    input.variant === 'primary'
      ? `${input.accountId}/logo-${Date.now()}.${ext}`
      : `${input.accountId}/logo-${input.variant}-${Date.now()}.${ext}`;
  const bucket =
    getSupabaseServerAdminClient().storage.from(BRAND_ASSETS_BUCKET);

  const { error: uploadError } = await bucket.upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: true,
  });

  if (uploadError) {
    console.error('[brand] upload-logo:', uploadError.message);
    const hint =
      uploadError.message?.toLowerCase().includes('bucket') ||
      uploadError.message?.toLowerCase().includes('not found')
        ? ' Run Supabase migrations to create the brand-assets storage bucket.'
        : '';
    throw new Error(
      (uploadError.message ||
        'Failed to upload logo. Ensure brand storage is configured.') + hint,
    );
  }

  const logoUrl = toSupabasePublicStorageUrl(
    bucket.getPublicUrl(path).data.publicUrl,
  );

  if (!logoUrl) {
    throw new Error('Upload succeeded but public URL could not be generated.');
  }

  const { nanoid } = await import('nanoid');
  const pictureUrl = `${logoUrl}?v=${nanoid(16)}`;

  if (input.variant === 'primary') {
    await syncWorkspaceLogo(input.accountId, pictureUrl);
  } else {
    await saveBrandLogoVariant(input.accountId, input.variant, pictureUrl);
  }

  return pictureUrl;
}
