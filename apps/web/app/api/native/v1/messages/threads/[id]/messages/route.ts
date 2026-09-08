import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import {
  listNativeThreadMessages,
  sendNativeThreadMessage,
} from '~/lib/native/messages';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SendMessageBodySchema = z.object({
  workspace: z.string().min(1),
  body: z.string().max(5000).optional().default(''),
  image_url: z.string().url().max(2048).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    if (!id) {
      return nativeBadRequest('thread id is required');
    }

    const search = new URL(request.url).searchParams;
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      search.get('workspace'),
    );
    const beforeRaw = search.get('before');
    const before = beforeRaw?.trim() || undefined;
    if (before && Number.isNaN(Date.parse(before))) {
      return nativeBadRequest('before must be an ISO datetime');
    }
    const limitRaw = search.get('limit');
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const items = await listNativeThreadMessages({
      userId: auth.context.userId,
      workspace,
      threadId: id,
      before,
      limit:
        Number.isFinite(limit) && limit
          ? Math.min(Math.max(limit, 1), 100)
          : undefined,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return handleNativeError(error, 'messages/messages');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    if (!id) {
      return nativeBadRequest('thread id is required');
    }

    const parsed = SendMessageBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );

    const message = await sendNativeThreadMessage({
      userId: auth.context.userId,
      workspace,
      threadId: id,
      body: parsed.data.body,
      imageUrl: parsed.data.image_url,
    });
    return NextResponse.json(message);
  } catch (error) {
    return handleNativeError(error, 'messages/messages');
  }
}
