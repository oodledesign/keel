import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export const runtime = 'nodejs';

const AVATARS_BUCKET = 'account_image';
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

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

async function loadPersonalAccount(userId: string) {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('accounts')
    .select('id, picture_url')
    .eq('primary_owner_user_id', userId)
    .eq('is_personal_account', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return data as { id: string; picture_url: string | null };
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

  const file = formData.get('file');
  const remove = formData.get('remove') === '1';

  const account = await loadPersonalAccount(user.id);

  if (!account) {
    return NextResponse.json(
      { error: 'Personal account not found' },
      { status: 404 },
    );
  }

  const admin = getSupabaseServerAdminClient();
  const bucket = admin.storage.from(AVATARS_BUCKET);
  const existingPath = storagePathFromPictureUrl(account.picture_url);

  if (remove) {
    if (existingPath) {
      await bucket.remove([existingPath]);
    }

    const { error: updateError } = await userClient
      .from('accounts')
      .update({ picture_url: null })
      .eq('id', account.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ pictureUrl: null });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Only image uploads are allowed.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Image is too large. Max size is 5MB.' },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extensionForMime(file.type || 'image/jpeg');
  const path = `${account.id}.${ext}`;

  if (existingPath && existingPath !== path) {
    await bucket.remove([existingPath]);
  }

  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });

  if (uploadError) {
    console.error('[account] upload-profile-image:', uploadError.message);
    return NextResponse.json(
      { error: uploadError.message || 'Failed to upload profile image.' },
      { status: 500 },
    );
  }

  const publicUrl = toSupabasePublicStorageUrl(
    bucket.getPublicUrl(path).data.publicUrl,
  );

  if (!publicUrl) {
    return NextResponse.json(
      { error: 'Upload succeeded but public URL could not be generated.' },
      { status: 500 },
    );
  }

  const { nanoid } = await import('nanoid');
  const pictureUrl = `${publicUrl}?v=${nanoid(16)}`;

  const { error: updateError } = await userClient
    .from('accounts')
    .update({ picture_url: pictureUrl })
    .eq('id', account.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ pictureUrl });
}
