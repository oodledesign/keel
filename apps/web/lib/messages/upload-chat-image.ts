import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createMessagesService } from '~/home/[account]/messages/_lib/server/messages.service';

export const CHAT_IMAGE_BUCKET = 'account_image';
export const MAX_CHAT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function safeSegment(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

export async function uploadChatThreadImage(params: {
  userId: string;
  threadId: string;
  bytes: Buffer;
  contentType: string;
  fileName: string;
  size: number;
}): Promise<{ imageUrl: string }> {
  if (!params.contentType.startsWith('image/')) {
    throw new Error('Only image uploads are allowed.');
  }

  if (params.size > MAX_CHAT_IMAGE_SIZE_BYTES) {
    throw new Error('Image is too large. Max size is 10MB.');
  }

  const service = createMessagesService();
  await service.assertCanUploadImage({
    userId: params.userId,
    threadId: params.threadId,
  });

  const admin = getSupabaseServerAdminClient();
  const { data: thread } = await admin
    .from('chat_threads')
    .select('account_id')
    .eq('id', params.threadId)
    .maybeSingle();

  const storageAccountId = (thread as { account_id?: string } | null)
    ?.account_id;
  if (!storageAccountId) {
    throw new Error('Thread not found.');
  }

  const ext = params.fileName.includes('.')
    ? params.fileName.split('.').pop() || 'jpg'
    : 'jpg';
  const fileName = `${crypto.randomUUID()}-${safeSegment(params.fileName) || 'image'}.${ext}`;
  const path = `${storageAccountId}/chat-${params.threadId}/${fileName}`;

  const { error: uploadError } = await admin.storage
    .from(CHAT_IMAGE_BUCKET)
    .upload(path, params.bytes, {
      contentType: params.contentType || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload image.');
  }

  const imageUrl = admin.storage.from(CHAT_IMAGE_BUCKET).getPublicUrl(path)
    .data.publicUrl;

  return { imageUrl };
}
