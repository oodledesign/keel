import { NextResponse } from 'next/server';

import {
  blockChatUser,
  listBlockedChatUsers,
} from '~/lib/messages/message-safety';
import { NativeBlockUserBodySchema } from '~/lib/messages/message-safety-shared';
import {
  parseRecorderBody,
  withRecorderAuth,
} from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return withRecorderAuth(request, 'recorder/messages/blocks', async (auth) =>
    NextResponse.json({ items: await listBlockedChatUsers(auth.user_id) }),
  );
}

export function POST(request: Request) {
  return withRecorderAuth(request, 'recorder/messages/blocks', async (auth) => {
    const body = await parseRecorderBody(request, NativeBlockUserBodySchema);
    return NextResponse.json(await blockChatUser(auth.user_id, body.user_id), {
      status: 201,
    });
  });
}
