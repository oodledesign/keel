import 'server-only';

import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { listNativeMessageThreads } from '~/lib/native/messages';
import {
  findNativeWorkspace,
  loadNativeWorkspaces,
} from '~/lib/native/workspace';
import { isUuid } from '~/lib/native/workspace-shared';

/**
 * Mac Assistant polls `/api/recorder/messages` and `/threads`.
 * Reuse the native thread list; default workspace is the device token account.
 */
export async function listRecorderMessageThreads(input: {
  userId: string;
  fallbackAccountId: string;
  workspaceRef?: string | null;
  limit?: number;
  clientId?: string | null;
}) {
  const admin = getSupabaseServerAdminClient();
  const workspaces = await loadNativeWorkspaces(admin, input.userId);
  const ref = input.workspaceRef?.trim() || input.fallbackAccountId;
  const workspace =
    findNativeWorkspace(workspaces, ref) ?? workspaces[0] ?? null;

  if (!workspace) {
    return { items: [] };
  }

  const items = await listNativeMessageThreads({
    userId: input.userId,
    workspace,
    limit: input.limit,
    clientId: input.clientId ?? undefined,
  });

  return { items };
}

function parseLimit(raw: string | null) {
  if (!raw) return undefined;
  const limit = Number.parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit < 1) return undefined;
  return Math.min(limit, 50);
}

/** GET handler for `/api/recorder/messages` and `/threads`. */
export async function handleRecorderMessageThreadsGet(
  request: Request,
  logName: string,
) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const url = new URL(request.url);
    const workspace =
      url.searchParams.get('workspace')?.trim() ||
      url.searchParams.get('account_id')?.trim() ||
      null;
    const clientId = url.searchParams.get('client')?.trim() || null;

    return NextResponse.json(
      await listRecorderMessageThreads({
        userId: auth.user_id,
        fallbackAccountId: auth.account_id,
        workspaceRef: workspace,
        limit: parseLimit(url.searchParams.get('limit')),
        clientId: clientId && isUuid(clientId) ? clientId : null,
      }),
    );
  } catch (error) {
    console.error(`[${logName}]`, error);
    return NextResponse.json({ items: [] });
  }
}
