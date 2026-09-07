import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { uploadNativeChatImage } from '~/lib/native/messages';
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

    return NextResponse.json(
      await uploadNativeChatImage({
        userId: auth.context.userId,
        workspace,
        threadId,
        file,
      }),
    );
  } catch (error) {
    return handleNativeError(error, 'messages');
  }
}
