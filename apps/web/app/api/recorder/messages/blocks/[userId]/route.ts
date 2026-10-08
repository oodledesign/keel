import { NextResponse } from 'next/server';

import { unblockChatUser } from '~/lib/messages/message-safety';
import { NativeHttpError } from '~/lib/native/http';
import { isUuid } from '~/lib/native/workspace-shared';
import { withRecorderAuth } from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return withRecorderAuth(request, 'recorder/messages/blocks', async (auth) => {
    const { userId } = await params;
    if (!isUuid(userId)) {
      throw new NativeHttpError(400, 'user id must be a UUID');
    }

    return NextResponse.json(await unblockChatUser(auth.user_id, userId));
  });
}
