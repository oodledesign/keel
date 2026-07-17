import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createMessagesService } from '../../../home/[account]/messages/_lib/server/messages.service';

export const runtime = 'nodejs';

const CHAT_IMAGE_BUCKET = 'account_image';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function safeSegment(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

export async function POST(request: Request) {
  const userClient = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();

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
  const accountSlug = String(formData.get('accountSlug') ?? '').trim();
  const threadId = String(formData.get('threadId') ?? '').trim();
  const file = formData.get('file');

  if (!accountId || !threadId || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'accountId, threadId, and file are required.' },
      { status: 400 },
    );
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Only image uploads are allowed.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Image is too large. Max size is 10MB.' },
      { status: 400 },
    );
  }

  const service = createMessagesService();
  try {
    await service.listMessages({
      accountId,
      userId: user.id,
      threadId,
      accountSlug: accountSlug || accountId,
      limit: 1,
    });
  } catch {
    return NextResponse.json(
      { error: 'You do not have access to this thread.' },
      { status: 403 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const fileName = `${crypto.randomUUID()}-${safeSegment(file.name) || 'image'}.${ext}`;
  const path = `${accountId}/chat-${threadId}/${fileName}`;

  const { error: uploadError } = await admin.storage
    .from(CHAT_IMAGE_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message || 'Failed to upload image.' },
      { status: 500 },
    );
  }

  const imageUrl = admin.storage.from(CHAT_IMAGE_BUCKET).getPublicUrl(path)
    .data.publicUrl;

  return NextResponse.json({ imageUrl });
}
