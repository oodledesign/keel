import { NextResponse } from 'next/server';

import {
  loadNativeAccountDeletionPreview,
  scheduleNativeAccountDeletion,
} from '~/lib/native/account-deletion';
import { parseNativeAccountDeleteConfirmation } from '~/lib/native/account-deletion-shared';
import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, readJsonBody } from '~/lib/native/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    return NextResponse.json(
      await loadNativeAccountDeletionPreview(auth.context),
    );
  } catch (error) {
    return handleNativeError(error, 'me/account');
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    parseNativeAccountDeleteConfirmation(await readJsonBody(request));

    const { scheduledFor } = await scheduleNativeAccountDeletion(auth.context);

    return NextResponse.json({ ok: true, scheduled_for: scheduledFor });
  } catch (error) {
    return handleNativeError(error, 'me/account');
  }
}
