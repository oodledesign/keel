import { NextResponse } from 'next/server';

import {
  blockChatUser,
  listBlockedChatUsers,
} from '~/lib/messages/message-safety';
import { NativeBlockUserBodySchema } from '~/lib/messages/message-safety-shared';
import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const items = await listBlockedChatUsers(auth.context.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return handleNativeError(error, 'messages/blocks');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = NativeBlockUserBodySchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const result = await blockChatUser(
      auth.context.userId,
      parsed.data.user_id,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleNativeError(error, 'messages/blocks');
  }
}
