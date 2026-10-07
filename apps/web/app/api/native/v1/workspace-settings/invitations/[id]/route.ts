import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { cancelNativeWorkspaceInvitation } from '~/lib/native/workspace-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const invitationId = Number((await params).id);
  const workspace =
    new URL(request.url).searchParams.get('workspace')?.trim() ?? '';
  if (!Number.isInteger(invitationId) || !workspace) {
    return nativeBadRequest('workspace and invitation id are required');
  }

  try {
    return NextResponse.json(
      await cancelNativeWorkspaceInvitation(
        auth.context,
        workspace,
        invitationId,
      ),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings/invitations');
  }
}
