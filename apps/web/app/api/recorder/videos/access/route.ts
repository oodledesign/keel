import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  assertVideoCreateAllowed,
  isAccountBillingExempt,
  loadAccountPlanLimits,
} from '~/lib/billing/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const accountId = url.searchParams.get('account_id') ?? auth.account_id;

  if (!accountId) {
    return badRequest('account_id is required');
  }

  const admin = getSupabaseServerAdminClient();

  try {
    await assertWorkspaceMember(admin, accountId, auth.user_id);
  } catch {
    return forbidden('Invalid workspace for this token');
  }

  const { count } = await admin
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);

  const videoCount = count ?? 0;
  const limits = await loadAccountPlanLimits(admin, accountId);
  const exempt = await isAccountBillingExempt(admin, accountId);
  const createCheck = await assertVideoCreateAllowed(
    admin,
    accountId,
    videoCount,
  );

  return NextResponse.json({
    account_id: accountId,
    video_count: videoCount,
    max_videos: exempt ? null : (limits?.max_videos ?? null),
    can_create: createCheck.allowed,
    reason: createCheck.reason ?? null,
  });
}
