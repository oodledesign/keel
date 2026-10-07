import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, readJsonBody } from '~/lib/native/http';
import { parseNativeWorkspaceRef } from '~/lib/native/settings-shared';
import { leaveNativeWorkspace } from '~/lib/native/workspace-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const workspace = parseNativeWorkspaceRef(await readJsonBody(request));
    return NextResponse.json(
      await leaveNativeWorkspace(auth.context, workspace),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings/leave');
  }
}
