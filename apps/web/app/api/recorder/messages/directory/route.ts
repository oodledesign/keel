import { NextResponse } from 'next/server';

import { loadNativeMessageDirectory } from '~/lib/native/messages';
import {
  recorderAccountRef,
  resolveRecorderWorkspace,
  withRecorderAuth,
} from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return withRecorderAuth(
    request,
    'recorder/messages/directory',
    async (auth) => {
      const workspace = await resolveRecorderWorkspace(
        auth,
        recorderAccountRef(request),
      );
      return NextResponse.json(
        await loadNativeMessageDirectory({ userId: auth.user_id, workspace }),
      );
    },
  );
}
