import { NextResponse } from 'next/server';

import { reportChatMessage } from '~/lib/messages/message-safety';
import { NativeReportMessageBodySchema } from '~/lib/messages/message-safety-shared';
import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = NativeReportMessageBodySchema.safeParse(
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

    const result = await reportChatMessage({
      userId: auth.context.userId,
      accountId: workspace.id,
      threadId: parsed.data.thread_id,
      messageId: parsed.data.message_id,
      reason: parsed.data.reason,
      details: parsed.data.details,
      block: parsed.data.block,
      source: 'ios',
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleNativeError(error, 'messages/reports');
  }
}
