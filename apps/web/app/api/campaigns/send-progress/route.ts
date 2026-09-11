import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createCampaignsService } from '~/lib/campaigns/campaigns.service';
import { denyUnlessCampaignsAccess } from '~/lib/campaigns/require-campaigns-api-access';

export const runtime = 'nodejs';

const querySchema = z.object({
  accountId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export const GET = enhanceRouteHandler(
  async ({ request, user }) => {
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      accountId: params.get('accountId'),
      campaignId: params.get('campaignId'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const { accountId, campaignId } = parsed.data;
    const client = getSupabaseServerClient();
    const denied = await denyUnlessCampaignsAccess(client, user.id, accountId);
    if (denied) return denied;

    try {
      const progress = await createCampaignsService(client).getSendProgress(
        accountId,
        campaignId,
      );
      return NextResponse.json(progress);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load send progress';
      const status = message === 'Campaign not found' ? 404 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  },
  { auth: true },
);
