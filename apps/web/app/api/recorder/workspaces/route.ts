import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';
import {
  authenticateRecorderRequest,
  recorderServiceUnavailable,
} from '~/lib/api-tokens/recorder-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const workspaces = await loadUserWorkspaceAccounts(admin, auth.user_id);

    return NextResponse.json(
      workspaces
        .filter((workspace) => workspace.slug)
        .map((workspace) => ({
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name?.trim() || workspace.slug,
          space_type: workspace.space_type,
        })),
    );
  } catch (error) {
    console.error('[recorder/workspaces]', error);
    return recorderServiceUnavailable(
      error instanceof Error ? error.message : undefined,
    );
  }
}
