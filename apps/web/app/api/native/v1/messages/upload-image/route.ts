import { NextResponse } from 'next/server';

import { uploadChatImage } from '~/lib/messages/upload-chat-image';
import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  NativeHttpError,
  handleNativeError,
  nativeBadRequest,
} from '~/lib/native/http';
import { requireNativeWorkspace } from '~/lib/native/workspace';
import { isUuid } from '~/lib/native/workspace-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return nativeBadRequest('Invalid form data');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      String(formData.get('workspace') ?? ''),
    );
    const threadId = String(
      formData.get('thread_id') ?? formData.get('threadId') ?? '',
    ).trim();
    const file = formData.get('file');

    if (!isUuid(threadId) || !(file instanceof File)) {
      return nativeBadRequest('thread_id and file are required.');
    }

    const uploaded = await uploadChatImage({
      userId: auth.context.userId,
      threadId,
      file,
      accountId: workspace.id,
    });

    return NextResponse.json({ image_url: uploaded.imageUrl });
  } catch (error) {
    if (error instanceof Error && !(error instanceof NativeHttpError)) {
      const lower = error.message.toLowerCase();
      if (lower.includes('not a participant') || lower.includes('access')) {
        return handleNativeError(
          new NativeHttpError(403, error.message),
          'messages',
        );
      }
      if (lower.includes('not found')) {
        return handleNativeError(
          new NativeHttpError(404, error.message),
          'messages',
        );
      }
      return handleNativeError(
        new NativeHttpError(400, error.message),
        'messages',
      );
    }
    return handleNativeError(error, 'messages');
  }
}
