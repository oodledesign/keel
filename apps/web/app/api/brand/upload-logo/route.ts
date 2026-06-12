import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { assertCanEditBrandSettings } from '~/home/[account]/settings/_lib/server/brand-settings-access';

export const runtime = 'nodejs';

const BRAND_ASSETS_BUCKET = 'brand-assets';
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

function extensionForMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
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

  try {
    await assertCanEditBrandSettings(accountId, user.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'You cannot edit brand settings.';
    const status = message === 'Account not found' ? 404 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extensionForMime(file.type || 'image/jpeg');
  const path = `${accountId}/logo-${Date.now()}.${ext}`;
  const admin = getSupabaseServerAdminClient();

  const { error: uploadError } = await admin.storage
    .from(BRAND_ASSETS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('[brand] upload-logo:', uploadError.message);
    return NextResponse.json(
      {
        error:
          uploadError.message ||
          'Failed to upload logo. Ensure brand storage is configured.',
      },
      { status: 500 },
    );
  }

  const logoUrl = admin.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path).data
    .publicUrl;

  return NextResponse.json({ logoUrl });
}
