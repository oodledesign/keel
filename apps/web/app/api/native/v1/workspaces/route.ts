import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import {
  loadNativeWorkspaces,
  publicNativeWorkspace,
} from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const workspaces = await loadNativeWorkspaces(
      auth.context.supabase,
      auth.context.userId,
    );
    return NextResponse.json(workspaces.map(publicNativeWorkspace));
  } catch (error) {
    return handleNativeError(error, 'workspaces');
  }
}
