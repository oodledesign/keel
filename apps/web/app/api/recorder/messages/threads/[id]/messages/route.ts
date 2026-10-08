import { NextResponse } from 'next/server';

import { NativeHttpError } from '~/lib/native/http';
import { sendNativeThreadMessage } from '~/lib/native/messages';
import { isUuid } from '~/lib/native/workspace-shared';
import {
  RecorderSendMessageBodySchema,
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
  return withRecorderAuth(request, 'recorder/messages/send', async (auth) => {
    const { id } = await params;
    if (!isUuid(id)) {
      throw new NativeHttpError(400, 'thread id must be a UUID');
    }

    const body = await parseRecorderBody(
      request,
      RecorderSendMessageBodySchema,
    );
    if (!body.body.trim() && !body.image_url && !body.attachments?.length) {
      throw new NativeHttpError(400, 'Message is empty');
    }

    const workspace = await resolveRecorderWorkspace(auth, body.account_id);
    const message = await sendNativeThreadMessage({
      userId: auth.user_id,
      workspace,
      threadId: id,
      body: body.body,
      imageUrl: body.image_url ?? undefined,
      attachments: body.attachments,
    });

    return NextResponse.json(message, { status: 201 });
  });
}
