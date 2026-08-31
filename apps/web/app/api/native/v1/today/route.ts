import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { loadNativeToday } from '~/lib/native/today';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const workspaceRef = new URL(request.url).searchParams.get('workspace');
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      workspaceRef,
    );
    const payload = await loadNativeToday(auth.context.userId, workspace);
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'today');
  }
}
