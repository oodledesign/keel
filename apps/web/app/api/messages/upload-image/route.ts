import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { uploadChatImage } from '~/lib/messages/upload-chat-image';

export const runtime = 'nodejs';

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

  const threadId = String(formData.get('threadId') ?? '').trim();
  const file = formData.get('file');

  if (!threadId || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'threadId and file are required.' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await uploadChatImage({
        userId: user.id,
        threadId,
        file,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload image.';
    const lower = message.toLowerCase();
    const status = lower.includes('not a participant')
      ? 403
      : lower.includes('not found')
        ? 404
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
