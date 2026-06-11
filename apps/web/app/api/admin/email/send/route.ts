import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import { sendCampaign } from '~/lib/admin-email/campaigns';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  await requireSuperAdmin();

  const body = (await request.json().catch(() => null)) as {
    campaignId?: string;
  } | null;

  if (!body?.campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
  }

  try {
    const result = await sendCampaign(body.campaignId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send campaign' },
      { status: 400 },
    );
  }
}
