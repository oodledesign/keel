import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { getNativeFinances } from '~/lib/native/invoices';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const finances = await getNativeFinances(auth.context.supabase, workspace);
    return NextResponse.json(finances);
  } catch (error) {
    return handleNativeError(error, 'finances');
  }
}
