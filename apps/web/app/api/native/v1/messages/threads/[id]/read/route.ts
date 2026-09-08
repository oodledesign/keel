import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { markNativeThreadRead } from '~/lib/native/messages';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ReadBodySchema = z.object({
  workspace: z.string().min(1),
});

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

    const parsed = ReadBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );

    const result = await markNativeThreadRead({
      userId: auth.context.userId,
      workspace,
      threadId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleNativeError(error, 'messages/read');
  }
}
