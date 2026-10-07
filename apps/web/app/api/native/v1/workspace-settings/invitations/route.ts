import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, readJsonBody } from '~/lib/native/http';
import { parseNativeInvitations } from '~/lib/native/settings-shared';
import { inviteNativeWorkspaceMembers } from '~/lib/native/workspace-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { workspace, invitations } = parseNativeInvitations(
      await readJsonBody(request),
    );
    return NextResponse.json(
      await inviteNativeWorkspaceMembers(auth.context, workspace, invitations),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings/invitations');
  }
}
