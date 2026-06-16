import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export const runtime = 'nodejs';

const AVATARS_BUCKET = 'account_image';
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function storagePathFromAvatarUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed || !trimmed.includes('/account_image/')) {
    return null;
  }

  return trimmed.split('/account_image/')[1]?.split('?')[0] ?? null;
}

function personPhotoPath(accountId: string, personId: string) {
  return `${accountId}/person-${personId}`;
}

async function loadOwnedPerson(userId: string, personId: string) {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('personal_people')
    .select('id, account_id, avatar_url')
    .eq('id', personId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return data as {
    id: string;
    account_id: string;
    avatar_url: string | null;
  };
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

  const personId = formData.get('personId');
  const remove = formData.get('remove') === '1';
  const file = formData.get('file');

  if (typeof personId !== 'string' || !personId.trim()) {
    return NextResponse.json({ error: 'personId is required' }, { status: 400 });
  }

  const person = await loadOwnedPerson(user.id, personId.trim());

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }

  const admin = getSupabaseServerAdminClient();
  const bucket = admin.storage.from(AVATARS_BUCKET);
  const existingPath = storagePathFromAvatarUrl(person.avatar_url);
  const nextPath = personPhotoPath(person.account_id, person.id);

  if (remove) {
    if (existingPath) {
      await bucket.remove([existingPath]);
    }

    const { error: updateError } = await userClient
      .from('personal_people')
      .update({ avatar_url: null })
      .eq('id', person.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ avatarUrl: null });
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

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Image is too large. Max size is 5MB.' },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (existingPath && existingPath !== nextPath) {
    await bucket.remove([existingPath]);
  }

  const { error: uploadError } = await bucket.upload(nextPath, bytes, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });

  if (uploadError) {
    console.error('[people] upload-photo:', uploadError.message);
    return NextResponse.json(
      { error: uploadError.message || 'Failed to upload photo.' },
      { status: 500 },
    );
  }

  const publicUrl = toSupabasePublicStorageUrl(
    bucket.getPublicUrl(nextPath).data.publicUrl,
  );

  if (!publicUrl) {
    return NextResponse.json(
      { error: 'Upload succeeded but public URL could not be generated.' },
      { status: 500 },
    );
  }

  const { nanoid } = await import('nanoid');
  const avatarUrl = `${publicUrl}?v=${nanoid(16)}`;

  const { error: updateError } = await userClient
    .from('personal_people')
    .update({ avatar_url: avatarUrl })
    .eq('id', person.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}
