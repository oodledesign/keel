import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { parseNativeWorkspaceNamePatch } from '~/lib/native/settings-shared';
import {
  loadNativeWorkspaceSettings,
  renameNativeWorkspace,
} from '~/lib/native/workspace-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const workspace =
    new URL(request.url).searchParams.get('workspace')?.trim() ?? '';
  if (!workspace) {
    return nativeBadRequest('workspace is required');
  }

  try {
    return NextResponse.json(
      await loadNativeWorkspaceSettings(auth.context, workspace),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings');
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { workspace, name } = parseNativeWorkspaceNamePatch(
      await readJsonBody(request),
    );
    return NextResponse.json(
      await renameNativeWorkspace(auth.context, workspace, name),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings');
  }
}
