import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  nativeNotFound,
  readJsonBody,
} from '~/lib/native/http';
import {
  NativeIsoDateTimeSchema,
  NativeSendMessageBodySchema,
  listNativeThreadMessages,
  sendNativeThreadMessage,
} from '~/lib/native/messages';
import { requireNativeWorkspace } from '~/lib/native/workspace';
import { isUuid } from '~/lib/native/workspace-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseThreadId(raw: string) {
  const threadId = raw.trim();
  return isUuid(threadId) ? threadId : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const threadId = parseThreadId((await params).threadId);
    if (!threadId) {
      return nativeNotFound('Thread not found');
    }

    const url = new URL(request.url);
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      url.searchParams.get('workspace'),
    );
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const beforeRaw = url.searchParams.get('before');
    const beforeParsed = beforeRaw
      ? NativeIsoDateTimeSchema.safeParse(beforeRaw)
      : null;
    const before =
      beforeParsed?.success === true ? beforeParsed.data : undefined;

    return NextResponse.json(
      await listNativeThreadMessages({
        userId: auth.context.userId,
        workspace,
        threadId,
        limit:
          limit && Number.isFinite(limit) && limit >= 1 && limit <= 100
            ? limit
            : undefined,
        before,
      }),
    );
  } catch (error) {
    return handleNativeError(error, 'messages');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const threadId = parseThreadId((await params).threadId);
    if (!threadId) {
      return nativeNotFound('Thread not found');
    }

    const parsed = NativeSendMessageBodySchema.safeParse(
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
      await sendNativeThreadMessage({
        userId: auth.context.userId,
        workspace,
        threadId,
        body: parsed.data.body,
        imageUrl: parsed.data.image_url,
        attachments: parsed.data.attachments,
      }),
    );
  } catch (error) {
    return handleNativeError(error, 'messages');
  }
}
