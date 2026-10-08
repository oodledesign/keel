import { NextResponse } from 'next/server';

import { reportChatMessage } from '~/lib/messages/message-safety';
import {
  RecorderReportMessageBodySchema,
  parseRecorderBody,
  resolveRecorderWorkspace,
  withRecorderAuth,
} from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return withRecorderAuth(
    request,
    'recorder/messages/reports',
    async (auth) => {
      const body = await parseRecorderBody(
        request,
        RecorderReportMessageBodySchema,
      );
      const workspace = await resolveRecorderWorkspace(auth, body.account_id);
      const result = await reportChatMessage({
        userId: auth.user_id,
        accountId: workspace.id,
        threadId: body.thread_id,
        messageId: body.message_id,
        reason: body.reason,
        details: body.details,
        block: body.block,
        source: 'mac',
      });

      return NextResponse.json(result, { status: 201 });
    },
  );
}
