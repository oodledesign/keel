import { NextResponse } from 'next/server';

import { createNativeMessageThread } from '~/lib/native/messages';
import { handleRecorderMessageThreadsGet } from '~/lib/recorder/list-recorder-message-threads';
import {
  RecorderCreateThreadBodySchema,
  parseRecorderBody,
  resolveRecorderWorkspace,
  withRecorderAuth,
} from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export function GET(request: Request) {
  return handleRecorderMessageThreadsGet(request, 'recorder/messages/threads');
}

export function POST(request: Request) {
  return withRecorderAuth(
    request,
    'recorder/messages/threads',
    async (auth) => {
      const body = await parseRecorderBody(
        request,
        RecorderCreateThreadBodySchema,
      );
      const workspace = await resolveRecorderWorkspace(auth, body.account_id);
      const created = await createNativeMessageThread({
        userId: auth.user_id,
        workspace,
        type: body.type,
        title: body.title ?? undefined,
        jobId: body.job_id,
        clientId: body.client_id,
        memberUserIds: body.member_user_ids,
        clientIds: body.client_ids,
        contactIds: body.contact_ids,
      });

      return NextResponse.json({ id: created.threadId }, { status: 201 });
    },
  );
}
