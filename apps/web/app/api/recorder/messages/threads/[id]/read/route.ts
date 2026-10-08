import { NextResponse } from 'next/server';

import { NativeHttpError } from '~/lib/native/http';
import { markNativeThreadRead } from '~/lib/native/messages';
import { isUuid } from '~/lib/native/workspace-shared';
import {
  RecorderAccountBodySchema,
  parseRecorderBody,
  resolveRecorderWorkspace,
  withRecorderAuth,
} from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRecorderAuth(request, 'recorder/messages/read', async (auth) => {
    const { id } = await params;
    if (!isUuid(id)) {
      throw new NativeHttpError(400, 'thread id must be a UUID');
    }

    const body = await parseRecorderBody(request, RecorderAccountBodySchema);
    const workspace = await resolveRecorderWorkspace(auth, body.account_id);
    await markNativeThreadRead({
      userId: auth.user_id,
      workspace,
      threadId: id,
    });

    return NextResponse.json({ ok: true });
  });
}
