import { NextResponse } from 'next/server';

import { NativeHttpError } from '~/lib/native/http';
import {
  NativeIsoDateTimeSchema,
  listNativeThreadMessages,
} from '~/lib/native/messages';
import { isUuid } from '~/lib/native/workspace-shared';
import {
  recorderAccountRef,
  resolveRecorderWorkspace,
  withRecorderAuth,
} from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 200;

export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRecorderAuth(request, 'recorder/messages/thread', async (auth) => {
    const { id } = await params;
    if (!isUuid(id)) {
      throw new NativeHttpError(400, 'thread id must be a UUID');
    }

    const search = new URL(request.url).searchParams;
    const beforeRaw = search.get('before')?.trim();
    if (beforeRaw && !NativeIsoDateTimeSchema.safeParse(beforeRaw).success) {
      throw new NativeHttpError(400, 'before must be an ISO date-time');
    }
    const limitRaw = Number.parseInt(search.get('limit') ?? '', 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw >= 1
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const workspace = await resolveRecorderWorkspace(
      auth,
      recorderAccountRef(request),
    );
    const items = await listNativeThreadMessages({
      userId: auth.user_id,
      workspace,
      threadId: id,
      before: beforeRaw || undefined,
      limit,
    });

    return NextResponse.json({ items, has_more: items.length >= limit });
  });
}
