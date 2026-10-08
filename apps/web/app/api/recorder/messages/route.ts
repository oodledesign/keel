import { NextResponse } from 'next/server';

import {
  listNativeMessageThreads,
  loadNativeMessageDirectory,
} from '~/lib/native/messages';
import {
  recorderAccountRef,
  resolveRecorderWorkspace,
  withRecorderAuth,
} from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/** Mac Assistant inbox bootstrap: threads plus the compose directory. */
export function GET(request: Request) {
  return withRecorderAuth(request, 'recorder/messages', async (auth) => {
    const workspace = await resolveRecorderWorkspace(
      auth,
      recorderAccountRef(request),
    );
    const [threads, directory] = await Promise.all([
      listNativeMessageThreads({ userId: auth.user_id, workspace }),
      loadNativeMessageDirectory({ userId: auth.user_id, workspace }),
    ]);

    return NextResponse.json({
      user_id: auth.user_id,
      account_id: workspace.id,
      account_slug: workspace.slug,
      can_message_clients: directory.can_message_clients,
      threads,
      // Older Mac builds poll this route for `{ items }`.
      items: threads,
      directory,
    });
  });
}
