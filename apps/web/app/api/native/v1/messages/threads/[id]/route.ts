import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { getNativeMessageThread } from '~/lib/native/messages';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    if (!id) {
      return nativeBadRequest('thread id is required');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const thread = await getNativeMessageThread(
      auth.context.userId,
      workspace,
      id,
    );
    return NextResponse.json(thread);
  } catch (error) {
    return handleNativeError(error, 'messages/thread');
  }
}
