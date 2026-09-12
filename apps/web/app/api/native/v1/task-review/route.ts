import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import {
  listNativeTaskReview,
  parseNativeTaskReviewSource,
} from '~/lib/native/task-review';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      url.searchParams.get('workspace'),
    );
    const payload = await listNativeTaskReview(
      auth.context.supabase,
      auth.context.userId,
      workspace,
      parseNativeTaskReviewSource(url.searchParams.get('source')),
    );
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'task-review');
  }
}
