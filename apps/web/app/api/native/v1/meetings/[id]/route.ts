import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { getNativeMeeting } from '~/lib/native/meetings';
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
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const meeting = await getNativeMeeting(
      auth.context.supabase,
      workspace,
      id,
    );
    return NextResponse.json(meeting);
  } catch (error) {
    return handleNativeError(error, 'meetings');
  }
}
