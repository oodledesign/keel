import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (auth instanceof NextResponse) {
    return auth;
  }

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
}
