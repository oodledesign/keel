import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { assertCanEditBrandSettings } from '~/home/[account]/settings/_lib/server/brand-settings-access';
import {
  saveBrandLogoVariant,
  syncWorkspaceLogo,
} from '~/lib/brand/sync-workspace-logo';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export const runtime = 'nodejs';

const BRAND_ASSETS_BUCKET = 'brand-assets';
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const LOGO_VARIANTS = ['primary', 'on_light', 'on_dark'] as const;

type LogoUploadVariant = (typeof LOGO_VARIANTS)[number];

function parseLogoVariant(value: unknown): LogoUploadVariant {
  const raw = String(value ?? 'primary').trim();
  return LOGO_VARIANTS.includes(raw as LogoUploadVariant)
    ? (raw as LogoUploadVariant)
    : 'primary';
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

async function authorizeWorkspaceLogoEdit(accountId: string, userId: string) {
  try {
    await assertCanEditBrandSettings(accountId, userId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'You cannot edit workspace settings.';
    const status = message === 'Account not found' ? 404 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  return null;
}

export async function POST(request: Request) {
  const userClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const accountId = String(formData.get('accountId') ?? '').trim();
  const variant = parseLogoVariant(formData.get('variant'));
  const file = formData.get('file');

  if (!accountId || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'accountId and file are required.' },
      { status: 400 },
    );
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Only image uploads are allowed.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Logo is too large. Max size is 5MB.' },
      { status: 400 },
    );
  }

  const authError = await authorizeWorkspaceLogoEdit(accountId, user.id);
  if (authError) return authError;

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extensionForMime(file.type || 'image/jpeg');
  const path =
    variant === 'primary'
      ? `${accountId}/logo-${Date.now()}.${ext}`
      : `${accountId}/logo-${variant}-${Date.now()}.${ext}`;
  const admin = getSupabaseServerAdminClient();

  const { error: uploadError } = await admin.storage
    .from(BRAND_ASSETS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('[brand] upload-logo:', uploadError.message);
    const hint =
      uploadError.message?.toLowerCase().includes('bucket') ||
      uploadError.message?.toLowerCase().includes('not found')
        ? ' Run Supabase migrations to create the brand-assets storage bucket.'
        : '';
    return NextResponse.json(
      {
        error:
          (uploadError.message ||
            'Failed to upload logo. Ensure brand storage is configured.') +
          hint,
      },
      { status: 500 },
    );
  }

  const logoUrl = toSupabasePublicStorageUrl(
    admin.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl,
  );

  if (!logoUrl) {
    return NextResponse.json(
      { error: 'Upload succeeded but public URL could not be generated.' },
      { status: 500 },
    );
  }

  const { nanoid } = await import('nanoid');
  const pictureUrl = `${logoUrl}?v=${nanoid(16)}`;

  try {
    if (variant === 'primary') {
      await syncWorkspaceLogo(accountId, pictureUrl);
    } else if (variant === 'on_light' || variant === 'on_dark') {
      await saveBrandLogoVariant(accountId, variant, pictureUrl);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save workspace logo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ logoUrl: pictureUrl, pictureUrl, variant });
}

export async function DELETE(request: Request) {
  const userClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { accountId?: string; variant?: string };
  try {
    body = (await request.json()) as { accountId?: string; variant?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const accountId = String(body.accountId ?? '').trim();
  const variant = parseLogoVariant(body.variant);
  if (!accountId) {
    return NextResponse.json(
      { error: 'accountId is required.' },
      { status: 400 },
    );
  }

  const authError = await authorizeWorkspaceLogoEdit(accountId, user.id);
  if (authError) return authError;

  try {
    if (variant === 'primary') {
      await syncWorkspaceLogo(accountId, null);
    } else if (variant === 'on_light' || variant === 'on_dark') {
      await saveBrandLogoVariant(accountId, variant, null);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to remove workspace logo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
