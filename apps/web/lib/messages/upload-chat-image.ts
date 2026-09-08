import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createMessagesService } from '~/home/[account]/messages/_lib/server/messages.service';

const CHAT_IMAGE_BUCKET = 'account_image';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function safeSegment(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

export async function uploadChatImage(params: {
  userId: string;
  threadId: string;
  file: File;
  /** When set, the thread must belong to this account. */
  accountId?: string;
}): Promise<{ imageUrl: string }> {
  if (!params.file.type.startsWith('image/')) {
    throw new Error('Only image uploads are allowed.');
  }

  if (params.file.size > MAX_IMAGE_SIZE_BYTES) {
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
  if (
    !storageAccountId ||
    (params.accountId && storageAccountId !== params.accountId)
  ) {
    throw new Error('Thread not found.');
  }

  const bytes = Buffer.from(await params.file.arrayBuffer());
  const ext = params.file.name.includes('.')
    ? params.file.name.split('.').pop()
    : 'jpg';
  const fileName = `${crypto.randomUUID()}-${safeSegment(params.file.name) || 'image'}.${ext}`;
  const path = `${storageAccountId}/chat-${params.threadId}/${fileName}`;

  const { error: uploadError } = await admin.storage
    .from(CHAT_IMAGE_BUCKET)
    .upload(path, bytes, {
      contentType: params.file.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload image.');
  }

  return {
    imageUrl: admin.storage.from(CHAT_IMAGE_BUCKET).getPublicUrl(path).data
      .publicUrl,
  };
}
