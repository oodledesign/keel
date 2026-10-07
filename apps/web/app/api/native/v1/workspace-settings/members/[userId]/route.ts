import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { removeNativeWorkspaceMember } from '~/lib/native/workspace-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const memberUserId = z
    .string()
    .uuid()
    .safeParse((await params).userId);
  const workspace =
    new URL(request.url).searchParams.get('workspace')?.trim() ?? '';
  if (!memberUserId.success || !workspace) {
    return nativeBadRequest('workspace and member id are required');
  }

  try {
    return NextResponse.json(
      await removeNativeWorkspaceMember(
        auth.context,
        workspace,
        memberUserId.data,
      ),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings/members');
  }
}
