import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import {
  NativeCreateThreadBodySchema,
  createNativeMessageThread,
  listNativeMessageThreads,
} from '~/lib/native/messages';
import { requireNativeWorkspace } from '~/lib/native/workspace';
import { isUuid } from '~/lib/native/workspace-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      url.searchParams.get('workspace'),
    );
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const clientId = url.searchParams.get('client') ?? undefined;

    return NextResponse.json(
      await listNativeMessageThreads({
        userId: auth.context.userId,
        workspace,
        limit:
          limit && Number.isFinite(limit) && limit >= 1 && limit <= 50
            ? limit
            : undefined,
        clientId: clientId && isUuid(clientId) ? clientId : undefined,
      }),
    );
  } catch (error) {
    return handleNativeError(error, 'messages');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = NativeCreateThreadBodySchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );

    return NextResponse.json(
      await createNativeMessageThread({
        userId: auth.context.userId,
        workspace,
        type: parsed.data.type,
        title: parsed.data.title,
        jobId: parsed.data.job_id,
        clientId: parsed.data.client_id,
        memberUserIds: parsed.data.member_user_ids,
        contactIds: parsed.data.contact_ids,
      }),
    );
  } catch (error) {
    return handleNativeError(error, 'messages');
  }
}
