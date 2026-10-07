import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readFormBlob,
  readJsonBody,
} from '~/lib/native/http';
import { parseNativeWorkspaceRef } from '~/lib/native/settings-shared';
import {
  removeNativeWorkspaceLogo,
  uploadNativeWorkspaceLogo,
} from '~/lib/native/workspace-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return nativeBadRequest('Invalid form data');
  }

  const workspace = String(form.get('workspace') ?? '').trim();
  if (!workspace) {
    return nativeBadRequest('workspace is required');
  }

  try {
    return NextResponse.json(
      await uploadNativeWorkspaceLogo(
        auth.context,
        workspace,
        readFormBlob(form),
      ),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings/logo');
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const workspace = parseNativeWorkspaceRef(await readJsonBody(request));
    return NextResponse.json(
      await removeNativeWorkspaceLogo(auth.context, workspace),
    );
  } catch (error) {
    return handleNativeError(error, 'workspace-settings/logo');
  }
}
