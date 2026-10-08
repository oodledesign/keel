import { NextResponse } from 'next/server';

import { z } from 'zod';

import { unblockChatUser } from '~/lib/messages/message-safety';
import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { userId } = await params;
    if (!z.string().uuid().safeParse(userId).success) {
      return nativeBadRequest('user id must be a UUID');
    }

    const result = await unblockChatUser(auth.context.userId, userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleNativeError(error, 'messages/blocks');
  }
}
