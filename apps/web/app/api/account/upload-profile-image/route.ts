import { NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadPersonalAccountPicture,
  removePersonalProfileImage,
  storePersonalProfileImage,
} from '~/lib/account/profile-image';

export const runtime = 'nodejs';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const userClient = getSupabaseServerClient() as SupabaseClient;
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

  let account: Awaited<ReturnType<typeof loadPersonalAccountPicture>>;
  try {
    account = await loadPersonalAccountPicture(userClient, user.id);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }

  if (!account) {
    return NextResponse.json(
      { error: 'Personal account not found' },
      { status: 404 },
    );
  }

  if (remove) {
    try {
      await removePersonalProfileImage({ client: userClient, account });
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 },
      );
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

  try {
    const pictureUrl = await storePersonalProfileImage({
      client: userClient,
      account,
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'image/jpeg',
    });

    return NextResponse.json({ pictureUrl });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to upload profile image.' },
      { status: 500 },
    );
  }
}
