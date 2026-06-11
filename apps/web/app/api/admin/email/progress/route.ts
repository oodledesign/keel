import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import { getCampaignProgress } from '~/lib/admin-email/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await requireSuperAdmin();

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
  }

  const progress = await getCampaignProgress(campaignId);

  if (!progress) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json(progress);
}
