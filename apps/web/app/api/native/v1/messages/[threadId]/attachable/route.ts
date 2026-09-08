import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeNotFound } from '~/lib/native/http';
import { listNativeAttachableItems } from '~/lib/native/messages';
import { requireNativeWorkspace } from '~/lib/native/workspace';
import { isUuid } from '~/lib/native/workspace-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const threadId = (await params).threadId.trim();
    if (!isUuid(threadId)) {
      return nativeNotFound('Thread not found');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );

    return NextResponse.json(
      await listNativeAttachableItems({
        userId: auth.context.userId,
        workspace,
        threadId,
      }),
    );
  } catch (error) {
    return handleNativeError(error, 'messages');
  }
}
