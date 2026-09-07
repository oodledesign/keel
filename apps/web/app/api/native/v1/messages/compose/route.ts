import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { listNativeMessageCompose } from '~/lib/native/messages';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const search = new URL(request.url).searchParams;
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      search.get('workspace'),
    );
    const payload = await listNativeMessageCompose({
      userId: auth.context.userId,
      workspace,
      query: search.get('q') ?? '',
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'messages/compose');
  }
}
