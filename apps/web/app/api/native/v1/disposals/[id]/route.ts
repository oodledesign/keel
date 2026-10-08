import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  NativeDisposalPatchSchema,
  getNativeDisposal,
  updateNativeDisposal,
} from '~/lib/native/disposals';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
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
    const disposal = await getNativeDisposal(
      auth.context.supabase,
      workspace,
      auth.context.userId,
      id,
    );
    return NextResponse.json(disposal);
  } catch (error) {
    return handleNativeError(error, 'disposals');
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const parsed = NativeDisposalPatchSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return nativeBadRequest(
        parsed.error.issues[0]?.message ?? 'Invalid request body',
      );
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const disposal = await updateNativeDisposal(
      auth.context.supabase,
      workspace,
      auth.context.userId,
      id,
      parsed.data,
    );
    return NextResponse.json(disposal);
  } catch (error) {
    return handleNativeError(error, 'disposals');
  }
}
